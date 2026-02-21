import fs from 'node:fs';
import path from 'node:path';

import boxen from 'boxen';
import chalk from 'chalk';

import { validateConfig } from '../../../core/src/state/validator';

const ICON_OK = '✔';
const ICON_WARN = '⚠';
const ICON_ERROR = '✖';

type CheckStatus = 'ok' | 'warn' | 'error';

type DoctorCheck = {
  title: string;
  status: CheckStatus;
  detail: string;
  suggestion: string;
};

type RegistryAnalysis = {
  importedSymbols: string[];
  symbolsInArray: string[];
  importedWrapperFiles: string[];
};

function readJsonConfigRaw(cwd: string): unknown {
  const configPath = path.join(cwd, 'landmaker.config.json');

  try {
    if (!fs.existsSync(configPath)) {
      return undefined;
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isSafePathSegment(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function sanitizeFileNameToken(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return sanitized.length > 0 ? sanitized : 'section';
}

function buildExpectedWrapperFiles(cwd: string, configRaw: unknown): string[] {
  const result = validateConfig(configRaw);
  const srcSectionsDir = path.join(cwd, 'src', 'sections');

  const expected: string[] = [];
  let absolutePosition = 0;

  for (const sections of Object.values(result.normalizedConfig.pages)) {
    for (const section of sections) {
      const hasSafeReference = isSafePathSegment(section.type) && Number.isFinite(section.variant);
      const templateFile = path.join(srcSectionsDir, section.type, String(section.variant), 'index.astro');
      const templateExists = fs.existsSync(templateFile);

      if (hasSafeReference && templateExists) {
        const typeToken = sanitizeFileNameToken(section.type);
        expected.push(`${typeToken}-${section.variant}-${absolutePosition}.astro`);
      }

      absolutePosition += 1;
    }
  }

  return expected;
}

function listWrapperFiles(cwd: string): string[] {
  const activeSectionsPath = path.join(cwd, 'src', 'active-sections');

  try {
    if (!fs.existsSync(activeSectionsPath)) {
      return [];
    }

    return fs
      .readdirSync(activeSectionsPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.astro'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function parseRegistry(cwd: string): RegistryAnalysis {
  const registryPath = path.join(cwd, 'src', 'section-registry.ts');

  try {
    const content = fs.readFileSync(registryPath, 'utf8');

    const importMatches = [...content.matchAll(/^\s*import\s+(\w+)\s+from\s+["']\.\/active-sections\/([^"']+)["'];?\s*$/gm)];
    const importedSymbols = importMatches.map((match) => match[1]);
    const importedWrapperFiles = importMatches.map((match) => match[2]);

    const arrayMatch = content.match(/export\s+const\s+sections\s*=\s*\[([^\]]*)\]/m);
    const symbolsInArray = arrayMatch
      ? arrayMatch[1]
          .split(',')
          .map((token) => token.trim())
          .filter((token) => token.length > 0)
      : [];

    return {
      importedSymbols,
      symbolsInArray,
      importedWrapperFiles,
    };
  } catch {
    return {
      importedSymbols: [],
      symbolsInArray: [],
      importedWrapperFiles: [],
    };
  }
}

function toStatusLine(check: DoctorCheck): string {
  if (check.status === 'ok') {
    return `${chalk.green(ICON_OK)} ${chalk.bold(check.title)}\n  ${check.detail}\n  ${chalk.dim(`Sugerencia: ${check.suggestion}`)}`;
  }

  if (check.status === 'warn') {
    return `${chalk.yellow(ICON_WARN)} ${chalk.bold(check.title)}\n  ${check.detail}\n  ${chalk.dim(`Sugerencia: ${check.suggestion}`)}`;
  }

  return `${chalk.red(ICON_ERROR)} ${chalk.bold(check.title)}\n  ${check.detail}\n  ${chalk.dim(`Sugerencia: ${check.suggestion}`)}`;
}

function reportBoxColor(checks: DoctorCheck[]): 'green' | 'yellow' | 'red' {
  if (checks.some((check) => check.status === 'error')) {
    return 'red';
  }

  if (checks.some((check) => check.status === 'warn')) {
    return 'yellow';
  }

  return 'green';
}

export function runDoctorCommand(cwd: string = process.cwd()): void {
  const checks: DoctorCheck[] = [];

  try {
    const configPath = path.join(cwd, 'landmaker.config.json');
    const configExists = fs.existsSync(configPath);

    const configRaw = readJsonConfigRaw(cwd);
    const validation = validateConfig(configRaw);

    if (!configExists) {
      checks.push({
        title: 'Config válido',
        status: 'error',
        detail: 'No se encontró landmaker.config.json.',
        suggestion: 'Ejecuta `landmaker init` para crear el archivo base.',
      });
    } else if (!validation.valid) {
      const sampleIssue = validation.issues[0];
      checks.push({
        title: 'Config válido',
        status: 'error',
        detail: sampleIssue
          ? `Se detectaron inconsistencias de configuración (${sampleIssue.code} en ${sampleIssue.path || 'root'}).`
          : 'Se detectaron inconsistencias de configuración.',
        suggestion: 'Revisa landmaker.config.json y corrige estructura/tipos inválidos.',
      });
    } else {
      checks.push({
        title: 'Config válido',
        status: 'ok',
        detail: 'landmaker.config.json es parseable y cumple estructura base.',
        suggestion: 'Mantén el archivo como única fuente de verdad.',
      });
    }

    const homeSections = validation.normalizedConfig.pages.home ?? [];

    if (homeSections.length === 0) {
      checks.push({
        title: 'Página no vacía',
        status: 'warn',
        detail: 'La página home no tiene secciones activas.',
        suggestion: 'Agrega secciones con `landmaker add <type> <variant> [theme]`.',
      });
    } else {
      checks.push({
        title: 'Página no vacía',
        status: 'ok',
        detail: `La página home tiene ${homeSections.length} sección(es) activas.`,
        suggestion: 'Usa `landmaker map` para revisar el orden renderizado.',
      });
    }

    const missingTemplates: string[] = [];
    const missingVariants: string[] = [];
    const sectionsRoot = path.join(cwd, 'src', 'sections');

    for (const [pageId, sections] of Object.entries(validation.normalizedConfig.pages)) {
      for (const section of sections) {
        const typeDir = path.join(sectionsRoot, section.type);
        const variantDir = path.join(typeDir, String(section.variant));
        const templatePath = path.join(variantDir, 'index.astro');

        if (!fs.existsSync(typeDir)) {
          missingTemplates.push(`${pageId}: ${section.type} (type no existe)`);
          continue;
        }

        if (!fs.existsSync(variantDir)) {
          missingVariants.push(`${pageId}: ${section.type}/${section.variant}`);
          continue;
        }

        if (!fs.existsSync(templatePath)) {
          missingTemplates.push(`${pageId}: ${section.type}/${section.variant}/index.astro`);
        }
      }
    }

    if (missingTemplates.length > 0) {
      checks.push({
        title: 'Secciones definidas existen físicamente',
        status: 'error',
        detail: `Faltan plantillas para ${missingTemplates.length} sección(es). Ejemplo: ${missingTemplates[0]}.`,
        suggestion: 'Crea los archivos faltantes en `src/sections/<type>/<variant>/index.astro`.',
      });
    } else {
      checks.push({
        title: 'Secciones definidas existen físicamente',
        status: 'ok',
        detail: 'Todas las secciones apuntan a una plantilla index.astro existente.',
        suggestion: 'Mantén convención `src/sections/<type>/<variant>/index.astro`.',
      });
    }

    if (missingVariants.length > 0) {
      checks.push({
        title: 'Variantes existen',
        status: 'error',
        detail: `Hay variantes no disponibles para ${missingVariants.length} sección(es). Ejemplo: ${missingVariants[0]}.`,
        suggestion: 'Crea la carpeta de variante o corrige el número en landmaker.config.json.',
      });
    } else {
      checks.push({
        title: 'Variantes existen',
        status: 'ok',
        detail: 'Cada sección referencia una carpeta de variante válida.',
        suggestion: 'Versiona las variantes de forma explícita para evitar huecos.',
      });
    }

    const expectedWrapperFiles = buildExpectedWrapperFiles(cwd, configRaw);
    const wrapperFiles = listWrapperFiles(cwd);

    const expectedSet = new Set(expectedWrapperFiles);
    const wrapperSet = new Set(wrapperFiles);

    const orphanWrappers = wrapperFiles.filter((file) => !expectedSet.has(file));

    if (orphanWrappers.length > 0) {
      checks.push({
        title: 'No hay wrappers huérfanos',
        status: 'warn',
        detail: `Se detectaron ${orphanWrappers.length} wrapper(s) fuera de sincronía. Ejemplo: ${orphanWrappers[0]}.`,
        suggestion: 'Regenera artefactos con un flujo que ejecute rebuild (por ejemplo `landmaker add/remove`).',
      });
    } else if (wrapperFiles.length === 0 && expectedWrapperFiles.length > 0) {
      checks.push({
        title: 'No hay wrappers huérfanos',
        status: 'warn',
        detail: 'No hay wrappers en src/active-sections pero sí se esperan según config.',
        suggestion: 'Ejecuta un comando que dispare rebuild para generar wrappers activos.',
      });
    } else {
      checks.push({
        title: 'No hay wrappers huérfanos',
        status: 'ok',
        detail: 'No se encontraron wrappers sobrantes respecto al estado esperado.',
        suggestion: 'Conserva src/active-sections como artefacto generado.',
      });
    }

    const registry = parseRegistry(cwd);
    const importedSet = new Set(registry.importedWrapperFiles);

    const wrappersMissingInRegistry = wrapperFiles.filter((file) => !importedSet.has(file));
    const registryMissingOnDisk = registry.importedWrapperFiles.filter((file) => !wrapperSet.has(file));
    const invalidSymbols = registry.symbolsInArray.filter((symbol) => !registry.importedSymbols.includes(symbol));

    if (wrappersMissingInRegistry.length > 0 || registryMissingOnDisk.length > 0 || invalidSymbols.length > 0) {
      const issueSample = wrappersMissingInRegistry[0] ?? registryMissingOnDisk[0] ?? invalidSymbols[0];
      checks.push({
        title: 'Registry coincide con wrappers',
        status: 'error',
        detail: `Registry y wrappers no coinciden (ejemplo: ${issueSample}).`,
        suggestion: 'Regenera section-registry.ts ejecutando un flujo que incluya rebuild.',
      });
    } else {
      checks.push({
        title: 'Registry coincide con wrappers',
        status: 'ok',
        detail: 'Los imports del registry y la lista `sections` están sincronizados con los wrappers activos.',
        suggestion: 'Evita editar manualmente src/section-registry.ts.',
      });
    }
  } catch {
    checks.push({
      title: 'Ejecución de diagnóstico',
      status: 'error',
      detail: 'El diagnóstico encontró una condición inesperada durante el análisis.',
      suggestion: 'Revisa permisos de lectura y estructura del proyecto, luego ejecuta `landmaker doctor` nuevamente.',
    });
  }

  const okCount = checks.filter((check) => check.status === 'ok').length;
  const warnCount = checks.filter((check) => check.status === 'warn').length;
  const errorCount = checks.filter((check) => check.status === 'error').length;

  const header = [
    chalk.bold('Landmaker doctor'),
    '',
    `${chalk.green(`${ICON_OK} ${okCount} correctos`)}  ${chalk.yellow(`${ICON_WARN} ${warnCount} advertencias`)}  ${chalk.red(`${ICON_ERROR} ${errorCount} errores`)}`,
  ].join('\n');

  const body = checks.map(toStatusLine).join('\n\n');
  const footer = chalk.dim('Diagnóstico no destructivo: no se modificó estado ni se ejecutó rebuild.');

  console.log(
    boxen([header, body, footer].join('\n\n'), {
      padding: 1,
      borderStyle: 'round',
      borderColor: reportBoxColor(checks),
    })
  );
}
