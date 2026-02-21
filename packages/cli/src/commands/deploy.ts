import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import boxen from 'boxen';
import chalk from 'chalk';

import { runDoctorCommand } from './doctor';
import { rebuildProject } from '../../../core/src/generator/rebuild';
import { loadConfig } from '../../../core/src/state/state';
import { validateConfig } from '../../../core/src/state/validator';

type RemovalTarget = {
  absolutePath: string;
  relativePath: string;
};

function readRawConfig(cwd: string): unknown {
  const configPath = path.join(cwd, 'landmaker.config.json');

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isWithinSectionsRoot(sectionsRoot: string, targetPath: string): boolean {
  const relative = path.relative(sectionsRoot, targetPath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function collectUsedTypeVariants(cwd: string): Map<string, Set<string>> {
  const config = loadConfig(cwd);
  const used = new Map<string, Set<string>>();

  for (const sections of Object.values(config.pages)) {
    for (const section of sections) {
      const variantSet = used.get(section.type) ?? new Set<string>();
      variantSet.add(String(section.variant));
      used.set(section.type, variantSet);
    }
  }

  return used;
}

function collectUnusedVariantDirectories(cwd: string, used: Map<string, Set<string>>): RemovalTarget[] {
  const sectionsRoot = path.join(cwd, 'src', 'sections');

  if (!fs.existsSync(sectionsRoot)) {
    return [];
  }

  const targets: RemovalTarget[] = [];
  const typeEntries = fs.readdirSync(sectionsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  for (const typeEntry of typeEntries) {
    const typeDir = path.join(sectionsRoot, typeEntry.name);
    const usedVariantsForType = used.get(typeEntry.name);

    if (!usedVariantsForType || usedVariantsForType.size === 0) {
      if (!isWithinSectionsRoot(sectionsRoot, typeDir)) {
        continue;
      }

      targets.push({
        absolutePath: typeDir,
        relativePath: path.relative(cwd, typeDir).replace(/\\/g, '/'),
      });
      continue;
    }

    const variantEntries = fs.readdirSync(typeDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());

    for (const variantEntry of variantEntries) {
      if (usedVariantsForType.has(variantEntry.name)) {
        continue;
      }

      const candidate = path.join(typeDir, variantEntry.name);
      if (!isWithinSectionsRoot(sectionsRoot, candidate)) {
        continue;
      }

      targets.push({
        absolutePath: candidate,
        relativePath: path.relative(cwd, candidate).replace(/\\/g, '/'),
      });
    }
  }

  return targets.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function askForConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question(chalk.yellow('¿Continuar? (y/n) '))).trim().toLowerCase();
    return answer === 'y' || answer === 'yes' || answer === 's' || answer === 'si';
  } finally {
    rl.close();
  }
}

function printAbort(message: string): void {
  console.log(
    boxen([chalk.bold('Landmaker deploy'), '', chalk.yellow(message)].join('\n'), {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
    })
  );
}

export async function runDeployCommand(cwd: string = process.cwd()): Promise<void> {
  try {
    console.log(chalk.bold('\nDiagnóstico previo (modo doctor):\n'));
    runDoctorCommand(cwd);

    const rawConfig = readRawConfig(cwd);
    const validation = validateConfig(rawConfig);

    if (!validation.valid) {
      printAbort('No se puede desplegar con un config inválido. Corrige los errores reportados por doctor y vuelve a intentar.');
      return;
    }

    const usedTypeVariants = collectUsedTypeVariants(cwd);
    const targets = collectUnusedVariantDirectories(cwd, usedTypeVariants);

    if (targets.length === 0) {
      console.log(
        boxen(
          [
            chalk.bold('Landmaker deploy'),
            '',
            chalk.green('No hay plantillas no utilizadas para limpiar.'),
            chalk.dim('El proyecto ya está optimizado con base en la configuración activa.'),
          ].join('\n'),
          {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'green',
          }
        )
      );

      const rebuildResult = rebuildProject(cwd);
      if (rebuildResult.warnings.length > 0) {
        for (const warning of rebuildResult.warnings) {
          console.log(chalk.dim(`- ${warning.code}: ${warning.message}`));
        }
      }
      return;
    }

    console.log(chalk.yellow(`\nSe eliminarán ${targets.length} plantillas no utilizadas.`));
    for (const target of targets) {
      console.log(chalk.dim(`- ${target.relativePath}`));
    }

    const confirmed = await askForConfirmation();
    if (!confirmed) {
      printAbort('Operación cancelada. No se eliminaron archivos.');
      return;
    }

    const deleted: string[] = [];
    for (const target of targets) {
      fs.rmSync(target.absolutePath, { recursive: true, force: true });
      deleted.push(target.relativePath);
    }

    const rebuildResult = rebuildProject(cwd);

    const summaryLines: string[] = [
      chalk.bold('Landmaker deploy'),
      '',
      chalk.green('✔ limpieza completada'),
      chalk.green('Proyecto optimizado para producción'),
      '',
      chalk.bold('Elementos eliminados:'),
      ...deleted.map((item) => `- ${item}`),
    ];

    if (rebuildResult.warnings.length > 0) {
      summaryLines.push('');
      summaryLines.push(chalk.yellow('Advertencias durante rebuild:'));
      for (const warning of rebuildResult.warnings) {
        summaryLines.push(chalk.dim(`- ${warning.code}: ${warning.message}`));
      }
    }

    console.log(
      boxen(summaryLines.join('\n'), {
        padding: 1,
        borderStyle: 'round',
        borderColor: rebuildResult.warnings.length > 0 ? 'yellow' : 'green',
      })
    );
  } catch {
    console.log(
      boxen(
        [
          chalk.bold('Landmaker deploy'),
          '',
          chalk.red('✖ No se pudo completar el deploy.'),
          chalk.dim('Sugerencia: revisa permisos de lectura/escritura e inténtalo nuevamente.'),
        ].join('\n'),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'red',
        }
      )
    );
  }
}
