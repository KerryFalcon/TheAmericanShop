import fs from 'node:fs';
import path from 'node:path';

import boxen from 'boxen';
import chalk from 'chalk';

type AvailableSection = {
  type: string;
  variants: number[];
};

const RECOMMENDED_FLOW = [
  {
    stage: '1. Apertura',
    objective: 'Capturar atención y explicar propuesta de valor.',
    sectionTypes: ['hero'],
  },
  {
    stage: '2. Beneficios',
    objective: 'Explicar qué problema resuelves y por qué te eligen.',
    sectionTypes: ['features'],
  },
  {
    stage: '3. Cierre de conversión',
    objective: 'Facilitar el contacto o la acción principal.',
    sectionTypes: ['contact'],
  },
];

function getAvailableSections(cwd: string): AvailableSection[] {
  const sectionsRoot = path.join(cwd, 'src', 'sections');

  if (!fs.existsSync(sectionsRoot)) {
    return [];
  }

  const typeEntries = fs
    .readdirSync(sectionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const result: AvailableSection[] = [];

  for (const type of typeEntries) {
    const typeDir = path.join(sectionsRoot, type);

    const variants = fs
      .readdirSync(typeDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => Number(entry.name))
      .filter((variant) => Number.isInteger(variant) && variant > 0)
      .sort((a, b) => a - b)
      .filter((variant) => {
        const templatePath = path.join(typeDir, String(variant), 'index.astro');
        return fs.existsSync(templatePath);
      });

    if (variants.length === 0) {
      continue;
    }

    result.push({ type, variants });
  }

  return result;
}

function buildRecommendationBlock(availableTypes: Set<string>): string[] {
  const lines: string[] = [chalk.bold('Recomendación de página completa')];

  for (const item of RECOMMENDED_FLOW) {
    const matches = item.sectionTypes.filter((type) => availableTypes.has(type));
    const status = matches.length > 0 ? chalk.green('✔') : chalk.yellow('⚠');

    lines.push('');
    lines.push(`${status} ${chalk.bold(item.stage)}`);
    lines.push(`  Objetivo: ${item.objective}`);
    lines.push(`  Secciones sugeridas: ${item.sectionTypes.join(', ')}`);

    if (matches.length > 0) {
      lines.push(`  Disponible ahora: ${matches.join(', ')}`);
    } else {
      lines.push(chalk.dim('  Disponible ahora: ninguna (considera crear esa sección).'));
    }
  }

  lines.push('');
  lines.push(chalk.dim('Ruta sugerida: Hero -> Features -> Contact (mínimo viable de conversión).'));

  return lines;
}

export function runListCommand(cwd: string = process.cwd()): void {
  try {
    const availableSections = getAvailableSections(cwd);

    if (availableSections.length === 0) {
      const content = [
        chalk.bold('Landmaker list'),
        '',
        chalk.yellow('No se encontraron secciones disponibles en `src/sections`.'),
        chalk.dim('Sugerencia: crea plantillas con la forma `src/sections/<type>/<variant>/index.astro`.'),
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

    const availableTypes = new Set(availableSections.map((section) => section.type));

    const listLines: string[] = [chalk.bold('Secciones disponibles')];
    for (const section of availableSections) {
      listLines.push(`- ${chalk.cyan(section.type)} ${chalk.dim(`(variantes: ${section.variants.join(', ')})`)}`);
    }

    const summaryLine = chalk.dim(
      `Total: ${availableSections.length} tipos de sección y ${availableSections.reduce((acc, item) => acc + item.variants.length, 0)} variantes utilizables.`
    );

    const content = [
      chalk.bold('Landmaker list'),
      '',
      ...listLines,
      '',
      summaryLine,
      '',
      ...buildRecommendationBlock(availableTypes),
    ].join('\n');

    console.log(
      boxen(content, {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green',
      })
    );
  } catch {
    const content = [
      chalk.bold('Landmaker list'),
      '',
      chalk.red('No se pudo listar las secciones disponibles.'),
      chalk.dim('Sugerencia: verifica permisos y estructura de `src/sections`.')
    ].join('\n');

    console.log(
      boxen(content, {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'red',
      })
    );
  }
}
