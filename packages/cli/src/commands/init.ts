import boxen from 'boxen';
import chalk from 'chalk';

import { ensureConfig, isLandmakerProject } from '../../../core/src/state/state';

/**
 * landmaker init
 *
 * Crea (o repara) el archivo fuente de verdad del proyecto:
 * landmaker.config.json
 *
 * Este comando existe para cerrar el ciclo UX con `landmaker map`:
 * cuando map detecta que falta config, init permite resolverlo en un paso.
 */
export function runInitCommand(cwd: string = process.cwd()): void {
  const existedBefore = isLandmakerProject(cwd);

  ensureConfig(cwd);

  const existsAfter = isLandmakerProject(cwd);

  if (!existsAfter) {
    const content = [
      chalk.bold('Landmaker init'),
      '',
      chalk.red('No se pudo crear landmaker.config.json en este directorio.'),
      chalk.dim('Verifica permisos de escritura e inténtalo nuevamente.'),
    ].join('\n');

    console.log(
      boxen(content, {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'red',
      })
    );
    return;
  }

  const content = existedBefore
    ? [
        chalk.bold('Landmaker init'),
        '',
        chalk.green('Proyecto Landmaker detectado.'),
        chalk.dim('landmaker.config.json ya existía y quedó listo para usarse.'),
      ].join('\n')
    : [
        chalk.bold('Landmaker init'),
        '',
        chalk.green('Proyecto Landmaker inicializado correctamente.'),
        `Siguiente paso: ejecuta ${chalk.cyan('landmaker map')} para ver la estructura actual.`,
      ].join('\n');

  console.log(
    boxen(content, {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green',
    })
  );
}
