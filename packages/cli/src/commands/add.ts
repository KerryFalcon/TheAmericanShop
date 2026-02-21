import chalk from 'chalk';
import ora from 'ora';

import { rebuildProject } from '../../../core/src/generator/rebuild';
import { isLandmakerProject, loadConfig, saveConfig } from '../../../core/src/state/state';

function printAddHelp(): void {
  console.log(chalk.bold('\nUso:'));
  console.log(`  ${chalk.cyan('landmaker add <type> <variant> [theme]')}`);
  console.log('');
  console.log('Ejemplos:');
  console.log(`  ${chalk.cyan('landmaker add hero 2')}`);
  console.log(`  ${chalk.cyan('landmaker add contact 1 dark')}`);
}

/**
 * landmaker add <type> <variant> [theme]
 *
 * Diseñado para edición declarativa:
 * - CLI solo muta el estado (config), nunca archivos del sitio directamente.
 * - Luego dispara rebuild para materializar el estado en artefactos renderizables.
 */
export function runAddCommand(args: string[], cwd: string = process.cwd()): void {
  if (!isLandmakerProject(cwd)) {
    console.log(chalk.red('No se encontró un proyecto Landmaker válido en este directorio.'));
    console.log(`Sugerencia: ejecuta ${chalk.cyan('landmaker init')} primero.`);
    return;
  }

  const [typeArg, variantArg, themeArg] = args;

  if (!typeArg || !variantArg) {
    console.log(chalk.yellow('Faltan argumentos para el comando add.'));
    printAddHelp();
    return;
  }

  const type = typeArg.trim();
  if (type.length === 0) {
    console.log(chalk.red('El argumento <type> debe ser un string no vacío.'));
    printAddHelp();
    return;
  }

  const variant = Number(variantArg);
  if (!Number.isInteger(variant) || variant <= 0) {
    console.log(chalk.red('El argumento <variant> debe ser un número entero positivo.'));
    printAddHelp();
    return;
  }

  const theme = typeof themeArg === 'string' && themeArg.trim().length > 0 ? themeArg.trim() : 'default';

  const spinner = ora('Actualizando estado del proyecto...').start();

  try {
    const config = loadConfig(cwd);

    if (!Array.isArray(config.pages.home)) {
      config.pages.home = [];
    }

    config.pages.home.push({
      type,
      variant,
      theme,
    });

    saveConfig(cwd, config);

    spinner.text = 'Regenerando archivos del proyecto...';
    const rebuildResult = rebuildProject(cwd);

    if (rebuildResult.warnings.length > 0) {
      spinner.warn(chalk.yellow('Sección agregada con advertencias durante rebuild.'));
      console.log(chalk.green('✔ sección agregada'));
      console.log(chalk.yellow('✔ página actualizada (con warnings)'));
      for (const warning of rebuildResult.warnings) {
        console.log(chalk.dim(`- ${warning.code}: ${warning.message}`));
      }
      return;
    }

    spinner.succeed(chalk.green('✔ sección agregada'));
    console.log(chalk.green('✔ página actualizada'));
  } catch {
    spinner.fail(chalk.red('No se pudo agregar la sección.'));
  }
}
