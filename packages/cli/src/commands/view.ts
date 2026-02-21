import fs from 'node:fs';
import path from 'node:path';

import boxen from 'boxen';
import chalk from 'chalk';

function printViewHelp(): void {
  console.log(chalk.bold('\nUso:'));
  console.log(`  ${chalk.cyan('landmaker view <type> <variant>')}`);
  console.log('');
  console.log('Ejemplos:');
  console.log(`  ${chalk.cyan('landmaker view hero 1')}      Ver la sección hero variante 1`);
  console.log(`  ${chalk.cyan('landmaker view gallery 2')}   Ver la sección gallery variante 2`);
  console.log(`  ${chalk.cyan('landmaker view pricing 3')}   Ver la sección pricing variante 3`);
}

/**
 * Extrae el bloque de comentario HTML principal (guía de sustitución)
 * que está al inicio del archivo .astro.
 */
function extractCommentBlock(source: string): string | null {
  const match = source.match(/^<!--\s*\n([\s\S]*?)-->/);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Extrae los elementos HTML principales con sus clases para dar
 * una vista estructural rápida de la sección.
 */
function extractStructure(source: string): string[] {
  // Quitar el bloque <style>...</style> y comentarios para analizar solo HTML
  const htmlOnly = source
    .replace(/---[\s\S]*?---/g, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const elements: string[] = [];
  const tagRegex = /<(section|div|header|aside|nav|form|ul|ol|dl|table|blockquote|h[1-6]|p|a|button|input|textarea|select|img|span|article)\b([^>]*?)>/gi;

  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = tagRegex.exec(htmlOnly)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];

    // Extraer clase si existe
    const classMatch = attrs.match(/class="([^"]+)"/);
    const cls = classMatch ? classMatch[1] : '';
    const ariaLabel = attrs.match(/aria-label="([^"]+)"/);

    let label = `<${tag}>`;
    if (cls) label = `<${tag} class="${cls}">`;

    // Evitar duplicados
    const key = `${tag}.${cls}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let description = '';
    if (ariaLabel) description = ` — ${ariaLabel[1]}`;

    elements.push(`${label}${description}`);
  }

  return elements;
}

/**
 * Extrae colores y gradientes del bloque <style> para mostrar
 * la paleta visual de la sección.
 */
function extractPalette(source: string): string[] {
  const styleMatch = source.match(/<style[\s\S]*?>([\s\S]*?)<\/style>/i);
  if (!styleMatch) return [];

  const css = styleMatch[1];
  const colors = new Set<string>();

  // Hex colors
  const hexMatches = css.matchAll(/#([0-9a-fA-F]{3,8})\b/g);
  for (const m of hexMatches) {
    colors.add(`#${m[1]}`);
  }

  // Gradientes (solo el tipo)
  const gradients: string[] = [];
  if (css.includes('linear-gradient')) gradients.push('linear-gradient');
  if (css.includes('radial-gradient')) gradients.push('radial-gradient');
  if (css.includes('repeating-linear-gradient')) gradients.push('repeating-linear-gradient');

  const result: string[] = [];

  if (colors.size > 0) {
    // Mostrar solo los colores principales (máximo 8)
    const colorArr = [...colors].slice(0, 8);
    result.push(`Colores: ${colorArr.join('  ')}`);
    if (colors.size > 8) {
      result.push(chalk.dim(`  ... y ${colors.size - 8} más`));
    }
  }

  if (gradients.length > 0) {
    result.push(`Gradientes: ${gradients.join(', ')}`);
  }

  // Animaciones
  const animations = new Set<string>();
  const animMatches = css.matchAll(/@keyframes\s+(\w+)/g);
  for (const m of animMatches) {
    animations.add(m[1]);
  }
  if (animations.size > 0) {
    result.push(`Animaciones: ${[...animations].join(', ')}`);
  }

  // Responsive
  const hasResponsive = css.includes('@media');
  if (hasResponsive) {
    result.push('Responsive: sí (incluye media queries)');
  }

  return result;
}

/**
 * Extrae los textos de contenido (lorem ipsum) para dar una idea
 * del contenido placeholder de la sección.
 */
function extractContentPreview(source: string): string[] {
  const htmlOnly = source
    .replace(/---[\s\S]*?---/g, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const texts: string[] = [];

  // Extraer contenido de h1, h2, h3, p con clase específica
  const headingRegex = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(htmlOnly)) !== null) {
    const tag = match[1].toUpperCase();
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text.length > 0) {
      texts.push(`${chalk.bold(tag)}: ${text.length > 60 ? text.slice(0, 57) + '...' : text}`);
    }
  }

  // Contar CTAs (links y buttons)
  const ctaCount = (htmlOnly.match(/<a\b[^>]*href/gi) || []).length;
  const buttonCount = (htmlOnly.match(/<button\b/gi) || []).length;
  const inputCount = (htmlOnly.match(/<input\b/gi) || []).length;

  if (ctaCount > 0) texts.push(`Links/CTAs: ${ctaCount}`);
  if (buttonCount > 0) texts.push(`Botones: ${buttonCount}`);
  if (inputCount > 0) texts.push(`Campos de formulario: ${inputCount}`);

  return texts;
}

/**
 * Cuenta las líneas de código del archivo.
 */
function countLines(source: string): { total: number; html: number; css: number } {
  const lines = source.split('\n');
  const total = lines.length;

  const styleMatch = source.match(/<style[\s\S]*?>([\s\S]*?)<\/style>/i);
  const cssLines = styleMatch ? styleMatch[1].split('\n').length : 0;
  const htmlLines = total - cssLines;

  return { total, html: htmlLines, css: cssLines };
}

export function runViewCommand(args: string[], cwd: string = process.cwd()): void {
  const [typeArg, variantArg] = args;

  if (!typeArg || !variantArg) {
    console.log(chalk.yellow('Faltan argumentos para el comando view.'));
    printViewHelp();
    return;
  }

  const type = typeArg.trim();
  const variant = Number(variantArg);

  if (!Number.isInteger(variant) || variant <= 0) {
    console.log(chalk.red('El argumento <variant> debe ser un número entero positivo.'));
    printViewHelp();
    return;
  }

  const templatePath = path.join(cwd, 'src', 'sections', type, String(variant), 'index.astro');

  if (!fs.existsSync(templatePath)) {
    const content = [
      chalk.bold('Landmaker view'),
      '',
      chalk.red(`No se encontró la sección ${chalk.bold(`${type}/${variant}`)}.`),
      chalk.dim(`Ruta esperada: src/sections/${type}/${variant}/index.astro`),
      '',
      chalk.dim(`Usa ${chalk.cyan('landmaker list')} para ver las secciones disponibles.`),
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

  const source = fs.readFileSync(templatePath, 'utf8');
  const lines = countLines(source);

  // ── Secciones de la vista ──────────────────────────────────────

  const outputLines: string[] = [
    chalk.bold('Landmaker view'),
    '',
    `${chalk.bold('Sección:')} ${chalk.cyan(type)} variante ${chalk.cyan(String(variant))}`,
    `${chalk.bold('Archivo:')} ${chalk.dim(`src/sections/${type}/${variant}/index.astro`)}`,
    `${chalk.bold('Tamaño:')} ${lines.total} líneas (${lines.html} HTML, ${lines.css} CSS)`,
  ];

  // 1. Guía de sustitución (del comentario HTML)
  const commentBlock = extractCommentBlock(source);
  if (commentBlock) {
    outputLines.push('');
    outputLines.push(chalk.bold.underline('Guía de sustitución'));

    // Extraer título y tabla
    const commentLines = commentBlock.split('\n');
    for (const line of commentLines) {
      if (line.includes('ELEMENTOS A SUSTITUIR') || line.includes('═') || line.includes('—')) {
        outputLines.push(chalk.yellow(line));
      } else if (line.includes('│')) {
        outputLines.push(chalk.dim(line));
      } else if (line.includes('┌') || line.includes('└') || line.includes('─')) {
        outputLines.push(chalk.dim(line));
      } else if (line.trim().length > 0) {
        outputLines.push(chalk.yellow(line));
      }
    }
  }

  // 2. Contenido placeholder
  const contentPreview = extractContentPreview(source);
  if (contentPreview.length > 0) {
    outputLines.push('');
    outputLines.push(chalk.bold.underline('Contenido placeholder'));
    for (const line of contentPreview) {
      outputLines.push(`  ${line}`);
    }
  }

  // 3. Estructura HTML
  const structure = extractStructure(source);
  if (structure.length > 0) {
    outputLines.push('');
    outputLines.push(chalk.bold.underline('Estructura HTML'));
    for (const el of structure.slice(0, 15)) {
      outputLines.push(`  ${chalk.green(el)}`);
    }
    if (structure.length > 15) {
      outputLines.push(chalk.dim(`  ... y ${structure.length - 15} elementos más`));
    }
  }

  // 4. Paleta y estilos
  const palette = extractPalette(source);
  if (palette.length > 0) {
    outputLines.push('');
    outputLines.push(chalk.bold.underline('Estilos'));
    for (const line of palette) {
      outputLines.push(`  ${line}`);
    }
  }

  // 5. Tip de uso
  outputLines.push('');
  outputLines.push(
    chalk.dim(`Para agregar esta sección: ${chalk.cyan(`landmaker add ${type} ${variant}`)}`)
  );

  console.log(
    boxen(outputLines.join('\n'), {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    })
  );
}
