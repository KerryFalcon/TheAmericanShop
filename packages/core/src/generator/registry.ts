/*
  Landmaker - Registry generation (ETAPA 2)

  ¿Por qué generar section-registry.ts automáticamente?
  - El estado canónico vive en landmaker.config.json.
  - src/active-sections contiene wrappers efímeros derivados de ese estado.
  - El registry conecta ambos mundos en un único archivo determinístico.

  Beneficio clave de sincronización:
  - Evitamos bugs donde el orden visual difiere del orden del config.
  - Cada rebuild regenera imports + array en el orden exacto de wrappers.
  - No depende de Astro runtime: sólo lectura/escritura de archivos.
*/

import fs from 'node:fs';
import path from 'node:path';

import type { GeneratedWrapper, RebuildWarning } from './wrappers';

const SRC_DIR = 'src';
const REGISTRY_FILE = 'section-registry.ts';

export type GenerateRegistryConfig = {
  cwd: string;
  wrappers: GeneratedWrapper[];
};

export type GenerateRegistryResult = {
  registryPath: string;
  warnings: RebuildWarning[];
};

function buildRegistryContent(wrappers: GeneratedWrapper[]): string {
  const importLines: string[] = [];
  const symbols: string[] = [];

  for (let i = 0; i < wrappers.length; i++) {
    const symbol = `S${i}`;
    const importPath = wrappers[i].importPath.replace(/\\/g, '/');
    importLines.push(`import ${symbol} from "${importPath}";`);
    symbols.push(symbol);
  }

  const body = [
    ...importLines,
    '',
    `export const sections = [${symbols.join(', ')}];`,
    '',
  ];

  return body.join('\n');
}

/**
 * Genera src/section-registry.ts en orden estable.
 *
 * Importante:
 * - Sólo incluye wrappers realmente generados (si una plantilla faltó, no se importa).
 * - Nunca lanza error fatal: retorna warnings para que el caller decida cómo reportar.
 */
export function generateRegistry(config: GenerateRegistryConfig): GenerateRegistryResult {
  const warnings: RebuildWarning[] = [];

  const srcPath = path.join(config.cwd, SRC_DIR);
  const registryPath = path.join(srcPath, REGISTRY_FILE);
  const content = buildRegistryContent(config.wrappers);

  try {
    fs.mkdirSync(srcPath, { recursive: true });
  } catch {
    warnings.push({
      code: 'registry_write_failed',
      filePath: srcPath,
      message: 'Failed to ensure src directory before writing section-registry.ts.',
    });
    return { registryPath, warnings };
  }

  try {
    fs.writeFileSync(registryPath, content, 'utf8');
  } catch {
    warnings.push({
      code: 'registry_write_failed',
      filePath: registryPath,
      message: 'Failed to write src/section-registry.ts.',
    });
  }

  return { registryPath, warnings };
}
