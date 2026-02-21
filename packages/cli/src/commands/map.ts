import boxen from 'boxen';
import chalk from 'chalk';

import { isLandmakerProject, loadConfig } from '../../../core/src/state/state';

/**
 * landmaker map
 *
 * Por qué existe antes que add/remove:
 * - Antes de mutar estado, el usuario necesita observabilidad del estado real.
 * - map crea una base de confianza: "esto es exactamente lo que Landmaker interpreta".
 *
 * Cómo previene errores:
 * - Hace visible el orden efectivo de render (la parte más sensible en páginas compuestas).
 * - Evita editar a ciegas cuando hay múltiples secciones repetidas.
 *
 * Cómo sirve para debug interno:
 * - Permite validar rápidamente si un problema es de estado (config) o de generación/render.
 * - Si map muestra algo distinto a lo esperado, el bug está upstream del renderer.
 */
export function runMapCommand(cwd: string = process.cwd()): void {
  if (!isLandmakerProject(cwd)) {
    const content = [
      chalk.bold('Landmaker map'),
      '',
      chalk.yellow('No se encontró landmaker.config.json en este proyecto.'),
      `Sugerencia: ejecuta ${chalk.cyan('landmaker init')} para inicializar Landmaker.`,
    ].join('\n');

    console.log(
      boxen(content, {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
      })
    );
    return;
  }

  const config = loadConfig(cwd);
  const pages = Object.entries(config.pages);

  const totalSections = pages.reduce((acc, [, sections]) => acc + sections.length, 0);

  if (totalSections === 0) {
    const content = [
      chalk.bold('Landmaker map'),
      '',
      'No hay secciones activas. Usa Landmaker para construir la página.',
    ].join('\n');

    console.log(
      boxen(content, {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'blue',
      })
    );
    return;
  }

  const blocks: string[] = [];

  for (const [pageId, sections] of pages) {
    blocks.push(chalk.bold(`Página: ${pageId}`));
    blocks.push('');

    if (sections.length === 0) {
      blocks.push(chalk.dim('Sin secciones activas en esta página.'));
      blocks.push('');
      continue;
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      blocks.push(`${chalk.cyan(String(i + 1))} ─ ${section.type} ${chalk.dim(`(variant ${section.variant})`)}`);
    }

    blocks.push('');
  }

  const content = [chalk.bold('Landmaker map'), '', ...blocks].join('\n').trimEnd();

  console.log(
    boxen(content, {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green',
    })
  );
}
