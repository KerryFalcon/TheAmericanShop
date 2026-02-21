/*
  Landmaker - Wrapper generation (ETAPA 2)

  ¿Por qué wrappers en lugar de importar templates directo desde Astro?
  - Astro (y ESM) cachea módulos por ruta de import.
  - Si la misma plantilla se repite varias veces en una página,
    importar la misma ruta directa no da identidad "única" por instancia.
  - El wrapper crea un archivo por posición (hero-2-0, hero-2-1, ...),
    lo que fuerza identidad estable por slot y evita colisiones lógicas.

  Resultado:
  - El estado (landmaker.config.json) define "qué" secciones existen y en qué orden.
  - Los wrappers materializan ese estado en artefactos físicos que el sitio consume.
*/

import fs from 'node:fs';
import path from 'node:path';

import type { LandmakerConfig, LandmakerSection } from '../state/types';

const SRC_DIR = 'src';
const SECTIONS_DIR = 'sections';
const ACTIVE_SECTIONS_DIR = 'active-sections';

export type RebuildWarningCode =
  | 'invalid_section_reference'
  | 'template_not_found'
  | 'wrapper_write_failed'
  | 'registry_write_failed'
  | 'cleanup_failed';

export type RebuildWarning = {
  code: RebuildWarningCode;
  message: string;
  pageId?: string;
  sectionIndex?: number;
  type?: string;
  variant?: number;
  filePath?: string;
};

export type GeneratedWrapper = {
  fileName: string;
  filePath: string;
  importPath: string;
  pageId: string;
  sectionIndex: number;
};

export type GenerateWrappersConfig = {
  cwd: string;
  config: LandmakerConfig;
};

export type GenerateWrappersResult = {
  wrappers: GeneratedWrapper[];
  warnings: RebuildWarning[];
};

function isSafePathSegment(value: string): boolean {
  // Restringimos a segmento simple para evitar path traversal y rutas ambiguas.
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function sanitizeFileNameToken(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return sanitized.length > 0 ? sanitized : 'section';
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}

function wrapperFileName(section: LandmakerSection, absolutePosition: number): string {
  const typeToken = sanitizeFileNameToken(section.type);
  return `${typeToken}-${section.variant}-${absolutePosition}.astro`;
}

function clearOldWrappers(activeSectionsPath: string): RebuildWarning[] {
  const warnings: RebuildWarning[] = [];

  try {
    fs.rmSync(activeSectionsPath, { recursive: true, force: true });
  } catch {
    warnings.push({
      code: 'cleanup_failed',
      filePath: activeSectionsPath,
      message: 'Could not clean previous active wrappers directory.',
    });
  }

  try {
    fs.mkdirSync(activeSectionsPath, { recursive: true });
  } catch {
    warnings.push({
      code: 'cleanup_failed',
      filePath: activeSectionsPath,
      message: 'Could not recreate active wrappers directory.',
    });
  }

  return warnings;
}

/**
 * Genera wrappers en src/active-sections desde el estado normalizado.
 *
 * Reglas aplicadas:
 * - Limpia wrappers anteriores antes de generar.
 * - Mantiene orden exacto del config (Object.entries + orden del array).
 * - Permite repetir la misma sección múltiples veces (archivo único por posición).
 * - Si falta una plantilla, no rompe: emite warning y continúa.
 */
export function generateWrappers(config: GenerateWrappersConfig): GenerateWrappersResult {
  const warnings: RebuildWarning[] = [];
  const wrappers: GeneratedWrapper[] = [];

  const srcPath = path.join(config.cwd, SRC_DIR);
  const sectionsRoot = path.join(srcPath, SECTIONS_DIR);
  const activeSectionsPath = path.join(srcPath, ACTIVE_SECTIONS_DIR);

  warnings.push(...clearOldWrappers(activeSectionsPath));

  let absolutePosition = 0;

  for (const [pageId, sections] of Object.entries(config.config.pages)) {
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const section = sections[sectionIndex];

      // Defensa adicional: el validador ya exige type/variant, pero aquí protegemos IO.
      if (!isSafePathSegment(section.type) || !Number.isFinite(section.variant)) {
        warnings.push({
          code: 'invalid_section_reference',
          pageId,
          sectionIndex,
          type: section.type,
          variant: section.variant,
          message:
            'Section reference is not filesystem-safe. Expected type [A-Za-z0-9_-] and numeric variant.',
        });
        absolutePosition++;
        continue;
      }

      const templateAbsPath = path.join(
        sectionsRoot,
        section.type,
        String(section.variant),
        'index.astro'
      );

      const templateRelImport = toPosixPath(
        path.join('..', SECTIONS_DIR, section.type, String(section.variant), 'index.astro')
      );

      if (!fs.existsSync(templateAbsPath)) {
        warnings.push({
          code: 'template_not_found',
          pageId,
          sectionIndex,
          type: section.type,
          variant: section.variant,
          filePath: templateAbsPath,
          message: 'Template file was not found. Wrapper skipped.',
        });
        absolutePosition++;
        continue;
      }

      const fileName = wrapperFileName(section, absolutePosition);
      const wrapperAbsPath = path.join(activeSectionsPath, fileName);
      const importPath = `./${ACTIVE_SECTIONS_DIR}/${fileName}`;

      const wrapperContent = [
        '---',
        `import Section from "${templateRelImport}";`,
        '---',
        '',
        '<Section />',
        '',
      ].join('\n');

      try {
        fs.writeFileSync(wrapperAbsPath, wrapperContent, 'utf8');
      } catch {
        warnings.push({
          code: 'wrapper_write_failed',
          pageId,
          sectionIndex,
          type: section.type,
          variant: section.variant,
          filePath: wrapperAbsPath,
          message: 'Failed to write wrapper file.',
        });
        absolutePosition++;
        continue;
      }

      wrappers.push({
        fileName,
        filePath: wrapperAbsPath,
        importPath,
        pageId,
        sectionIndex,
      });

      absolutePosition++;
    }
  }

  return { wrappers, warnings };
}
