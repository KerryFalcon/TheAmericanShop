import chalk from 'chalk';
import ora from 'ora';

import { rebuildProject } from '../../../core/src/generator/rebuild';
import { isLandmakerProject, loadConfig, saveConfig } from '../../../core/src/state/state';

function printRemoveHelp(): void {
  console.log(chalk.bold('\nUso:'));
  console.log(`  ${chalk.cyan('landmaker remove <index>')}`);
  console.log('');
  console.log('Ejemplo:');
  console.log(`  ${chalk.cyan('landmaker remove 2')}`);
}

/**
 * landmaker remove <index>
 *
 * Seguridad operacional:
 * - Remueve por índice mostrado en `map` (base 1) para evitar ambigüedad.
 * - Solo modifica estado vía core y luego reconstruye artefactos derivados.
 * - Nunca borra archivos del sitio manualmente desde el CLI.
 */
export function runRemoveCommand(args: string[], cwd: string = process.cwd()): void {
  if (!isLandmakerProject(cwd)) {
    console.log(chalk.red('No se encontró un proyecto Landmaker válido en este directorio.'));
    console.log(`Sugerencia: ejecuta ${chalk.cyan('landmaker init')} primero.`);
    return;
  }

  const [indexArg] = args;

  if (!indexArg) {
    console.log(chalk.yellow('Falta el índice para eliminar una sección.'));
    printRemoveHelp();
    return;
  }

  const index = Number(indexArg);
  if (!Number.isInteger(index) || index <= 0) {
    console.log(chalk.red('El argumento <index> debe ser un número entero positivo (base 1).'));
    printRemoveHelp();
    return;
  }

  const spinner = ora('Actualizando estado del proyecto...').start();

  try {
    const config = loadConfig(cwd);
    const homeSections = Array.isArray(config.pages.home) ? config.pages.home : [];

    if (homeSections.length === 0) {
      spinner.warn(chalk.yellow('No hay secciones activas para eliminar en la página home.'));
      return;
    }

    const targetIndex = index - 1;
    if (targetIndex < 0 || targetIndex >= homeSections.length) {
      spinner.fail(
        chalk.red(
          `Índice fuera de rango. Elige un índice entre 1 y ${homeSections.length} según el comando map.`
        )
      );
      return;
    }

    homeSections.splice(targetIndex, 1);
    config.pages.home = homeSections;

    saveConfig(cwd, config);

    spinner.text = 'Regenerando archivos del proyecto...';
    const rebuildResult = rebuildProject(cwd);

    if (rebuildResult.warnings.length > 0) {
      spinner.warn(chalk.yellow('Sección eliminada con advertencias durante rebuild.'));
      console.log(chalk.green('✔ sección eliminada'));
      console.log(chalk.yellow('✔ página actualizada (con warnings)'));
      for (const warning of rebuildResult.warnings) {
        console.log(chalk.dim(`- ${warning.code}: ${warning.message}`));
      }
      return;
    }

    spinner.succeed(chalk.green('✔ sección eliminada'));
    console.log(chalk.green('✔ página actualizada'));
  } catch {
    spinner.fail(chalk.red('No se pudo eliminar la sección.'));
  }
}
