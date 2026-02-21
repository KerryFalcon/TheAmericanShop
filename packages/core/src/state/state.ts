/*
  Landmaker - Project State IO (ETAPA 1)

  Este archivo implementa el acceso a la fuente de verdad: landmaker.config.json

  Por qué el config es la fuente de verdad absoluta:
  - El constructor (y el futuro CLI) deben operar sobre un estado único, serializable y validable.
  - Los archivos del sitio son un "output" derivado; pueden regenerarse.

  Por qué NO confiar en el filesystem como estado:
  - El filesystem es un medio de almacenamiento, no un modelo de dominio.
  - Puede cambiar fuera de nuestro control (ediciones manuales, merges, scripts, crashes).
  - Es difícil garantizar consistencia si el estado está disperso en múltiples archivos.

  Cómo evitar corrupción del estado:
  - Nunca hacemos writes parciales sobre el archivo final.
  - Guardamos con estrategia best-effort tipo "write-temp + replace".
  - Normalizamos antes de guardar: sólo persistimos datos válidos.

  Nota: En esta etapa, estas funciones son síncronas.
  - CLI tools típicamente son síncronas/lineales y la simplicidad reduce bugs.
  - Si en el futuro se requiere async, se puede introducir una API paralela.
*/

import fs from 'node:fs';
import path from 'node:path';

import { LANDMAKER_CONFIG_FILE } from './types';
import type { LandmakerConfig } from './types';
import { normalizeConfig, validateConfig } from './validator';

function configPath(cwd: string): string {
  return path.join(cwd, LANDMAKER_CONFIG_FILE);
}

function safeReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function stableStringify(config: LandmakerConfig): string {
  // Serialización estable para minimizar diffs y reducir riesgo de corrupción.
  // El orden de keys de JSON.stringify sigue el orden de inserción.
  // Aquí construimos una forma canónica para el primer nivel.
  const canonical: LandmakerConfig = {
    pages: config.pages,
  };

  return `${JSON.stringify(canonical, null, 2)}\n`;
}

function safeWriteAtomic(filePath: string, contents: string): void {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);

  // Si el directorio no existe o no hay permisos, fallamos silenciosamente.
  // La capa CLI decidirá cómo reportar al usuario.
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    return;
  }

  const tmpPath = path.join(
    dir,
    `${base}.tmp-${process.pid}-${Date.now().toString(36)}`
  );
  const backupPath = path.join(dir, `${base}.bak`);

  try {
    fs.writeFileSync(tmpPath, contents, 'utf8');
  } catch {
    // Si no podemos escribir ni el temporal, no podemos hacer nada.
    return;
  }

  // Reemplazo best-effort:
  // - En Windows, rename puede fallar si el destino existe.
  // - Para reducir riesgo de pérdida, intentamos backup/restore.
  let success = false;

  try {
    if (fs.existsSync(filePath)) {
      try {
        // Si ya existe un backup previo, intentamos removerlo.
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      } catch {
        // ignorar
      }

      try {
        fs.renameSync(filePath, backupPath);
      } catch {
        // Si no se puede mover a backup (locks/permisos), seguimos.
      }
    }

    try {
      fs.renameSync(tmpPath, filePath);
      success = true;
    } catch {
      // Último recurso: copiar contenido al destino.
      try {
        fs.copyFileSync(tmpPath, filePath);
        success = true;
      } catch {
        success = false;
      }
    }
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignorar
    }

    if (success) {
      // Limpiamos backup si el replace funcionó.
      try {
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      } catch {
        // ignorar
      }
    } else {
      // Intentamos restaurar backup si existe.
      try {
        if (!fs.existsSync(filePath) && fs.existsSync(backupPath)) {
          fs.renameSync(backupPath, filePath);
        }
      } catch {
        // ignorar
      }
    }
  }
}

/**
 * Determina si el cwd parece ser un proyecto Landmaker.
 *
 * Nota de diseño:
 * - En herramientas CLI conviene detectar por presencia del archivo fuente de verdad.
 * - Si el archivo existe pero está corrupto, sigue siendo "un proyecto" porque podemos repararlo.
 */
export function isLandmakerProject(cwd: string): boolean {
  try {
    const fp = configPath(cwd);
    const stat = fs.statSync(fp);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Asegura que exista un landmaker.config.json y que sea usable.
 *
 * Comportamiento:
 * - Si no existe, crea uno válido.
 * - Si existe pero está corrupto/invalid, lo normaliza y lo re-escribe.
 *
 * Nunca lanza.
 */
export function ensureConfig(cwd: string): void {
  const fp = configPath(cwd);

  // Si no existe, lo creamos con un default válido.
  if (!isLandmakerProject(cwd)) {
    const normalized = normalizeConfig(undefined);
    safeWriteAtomic(fp, stableStringify(normalized));
    return;
  }

  const rawText = safeReadFile(fp);
  if (rawText === null) {
    // Existe pero no lo podemos leer. No es fatal.
    return;
  }

  const parsed = safeParseJson(rawText);
  const result = validateConfig(parsed);
  const normalizedText = stableStringify(result.normalizedConfig);

  // Auto-corrección: si el archivo actual difiere, persistimos el normalizado.
  if (rawText !== normalizedText) {
    safeWriteAtomic(fp, normalizedText);
  }
}

/**
 * Lee el config y devuelve SIEMPRE un LandmakerConfig usable.
 *
 * Nota:
 * - No escribe automáticamente.
 * - Para auto-reparar en disco, llama ensureConfig(cwd).
 */
export function loadConfig(cwd: string): LandmakerConfig {
  const fp = configPath(cwd);
  const rawText = safeReadFile(fp);

  if (rawText === null) {
    return normalizeConfig(undefined);
  }

  const parsed = safeParseJson(rawText);
  return normalizeConfig(parsed);
}

/**
 * Guarda config a disco de forma robusta.
 *
 * Invariante:
 * - Nunca se guarda algo que no pase por normalización.
 */
export function saveConfig(cwd: string, config: LandmakerConfig): void {
  const fp = configPath(cwd);
  const normalized = validateConfig(config).normalizedConfig;
  safeWriteAtomic(fp, stableStringify(normalized));
}

export { validateConfig, normalizeConfig };
