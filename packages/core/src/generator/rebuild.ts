/*
  Landmaker - Rebuild orchestrator (ETAPA 2)

  rebuildProject(cwd) es el punto central del motor generativo basado en archivos.

  Flujo:
  1) Lee landmaker.config.json (fuente de verdad) usando el módulo de estado.
  2) Regenera wrappers en src/active-sections.
  3) Regenera src/section-registry.ts en el mismo orden.

  ¿Por qué este orquestador evita bugs de sincronización?
  - Obliga a reconstruir TODOS los artefactos derivados en un único flujo.
  - Evita estados mixtos (wrappers viejos + registry nuevo, o viceversa).
  - Cualquier edición manual del config se refleja al ejecutar rebuild.

  Restricción de esta etapa:
  - No modifica el config.
  - No depende de Astro runtime.
  - Sólo usa filesystem.
*/

import path from 'node:path';

import { loadConfig } from '../state/state';
import { generateRegistry } from './registry';
import { generateWrappers } from './wrappers';
import type { GeneratedWrapper, RebuildWarning } from './wrappers';

export type RebuildProjectResult = {
  cwd: string;
  wrappersDir: string;
  registryPath: string;
  wrappers: GeneratedWrapper[];
  warnings: RebuildWarning[];
};

/**
 * Reconstruye artefactos derivados del proyecto Landmaker.
 *
 * Nunca lanza error fatal por problemas de contenido del config o plantillas faltantes.
 * Cualquier incidente se reporta como warning para que la capa CLI pueda mostrarlo.
 */
export function rebuildProject(cwd: string): RebuildProjectResult {
  const warnings: RebuildWarning[] = [];

  const config = loadConfig(cwd);

  const wrappersResult = generateWrappers({ cwd, config });
  warnings.push(...wrappersResult.warnings);

  const registryResult = generateRegistry({
    cwd,
    wrappers: wrappersResult.wrappers,
  });
  warnings.push(...registryResult.warnings);

  return {
    cwd,
    wrappersDir: path.join(cwd, 'src', 'active-sections'),
    registryPath: registryResult.registryPath,
    wrappers: wrappersResult.wrappers,
    warnings,
  };
}
