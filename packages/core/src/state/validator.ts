/*
  Landmaker - Config validator/normalizer (ETAPA 1)

  OBJETIVO
  - Validar y normalizar cualquier input (incluido JSON corrupto o parcialmente inválido)
    hacia un LandmakerConfig SIEMPRE usable.

  Principios de estabilidad (CLI tools):
  - Nunca lanzar excepción fatal por input del usuario.
  - Siempre producir un estado consistente con invariantes mínimas.
  - Eliminar valores inválidos ("lo malo no pasa") en vez de intentar adivinar.

  Nota:
  - Este archivo NO toca filesystem.
  - Es puro: entrada -> resultado.
*/

import type {
  LandmakerConfig,
  LandmakerPage,
  LandmakerSection,
  ValidationIssue,
  ValidationResult,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defaultConfig(): LandmakerConfig {
  return { pages: { home: [] } };
}

function pushIssue(
  issues: ValidationIssue[],
  issue: Omit<ValidationIssue, 'severity'> & { severity?: ValidationIssue['severity'] }
): void {
  issues.push({ severity: issue.severity ?? 'error', ...issue });
}

function normalizeSection(
  value: unknown,
  issues: ValidationIssue[],
  path: string
): LandmakerSection | null {
  if (!isRecord(value)) {
    pushIssue(issues, {
      code: 'section_not_object',
      path,
      message: 'Section must be an object.',
    });
    return null;
  }

  const type = value.type;
  if (typeof type !== 'string' || type.trim() === '') {
    pushIssue(issues, {
      code: typeof type === 'undefined' ? 'section_type_missing' : 'section_type_invalid',
      path: `${path}.type`,
      message: 'Section.type must be a non-empty string.',
    });
    return null;
  }

  const variant = value.variant;
  if (typeof variant !== 'number' || !Number.isFinite(variant)) {
    pushIssue(issues, {
      code:
        typeof variant === 'undefined'
          ? 'section_variant_missing'
          : 'section_variant_invalid',
      path: `${path}.variant`,
      message: 'Section.variant must be a finite number.',
    });
    return null;
  }

  const theme = value.theme;
  if (typeof theme !== 'undefined' && typeof theme !== 'string') {
    // theme es opcional, pero si existe debe ser string
    pushIssue(issues, {
      code: 'section_theme_invalid',
      severity: 'warn',
      path: `${path}.theme`,
      message: 'Section.theme must be a string when provided.',
    });
  }

  // Conservamos campos extra para no romper forward-compat.
  // Pero garantizamos que type/variant/theme tengan tipos esperados.
  const normalized: LandmakerSection = {
    ...value,
    type: type.trim(),
    variant,
  };

  if (typeof theme === 'string') normalized.theme = theme;
  else delete (normalized as { theme?: unknown }).theme;

  return normalized;
}

function normalizePage(
  value: unknown,
  issues: ValidationIssue[],
  path: string
): LandmakerPage {
  if (!Array.isArray(value)) {
    pushIssue(issues, {
      code: 'page_not_array',
      path,
      message: 'Each page must be an array.',
    });
    return [];
  }

  const out: LandmakerSection[] = [];
  for (let i = 0; i < value.length; i++) {
    const section = normalizeSection(value[i], issues, `${path}[${i}]`);
    if (section) out.push(section);
  }
  return out;
}

/**
 * Normaliza SIN tirar.
 * - Si el config está roto, devuelve uno default.
 * - Elimina páginas/secciones inválidas.
 */
export function normalizeConfig(config: unknown): LandmakerConfig {
  const result = validateConfig(config);
  // validateConfig ya produce normalizedConfig, así que reutilizamos.
  // Esta función existe como API simplificada para el CLI.
  return result.normalizedConfig;
}

/**
 * Valida y retorna un config normalizado (siempre usable).
 */
export function validateConfig(config: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isRecord(config)) {
    pushIssue(issues, {
      code: 'config_not_object',
      path: '',
      message: 'Config root must be an object.',
    });

    const normalizedConfig = defaultConfig();
    return {
      valid: false,
      issues,
      normalizedConfig,
    };
  }

  const pagesRaw = (config as Record<string, unknown>).pages;

  if (typeof pagesRaw === 'undefined') {
    pushIssue(issues, {
      code: 'pages_missing',
      path: 'pages',
      message: 'Config.pages is required.',
    });

    const normalizedConfig = defaultConfig();
    return {
      valid: false,
      issues,
      normalizedConfig,
    };
  }

  if (!isRecord(pagesRaw)) {
    pushIssue(issues, {
      code: 'pages_not_object',
      path: 'pages',
      message: 'Config.pages must be an object mapping page ids to arrays.',
    });

    const normalizedConfig = defaultConfig();
    return {
      valid: false,
      issues,
      normalizedConfig,
    };
  }

  const pagesOut: Record<string, LandmakerPage> = {};

  for (const [pageId, pageValue] of Object.entries(pagesRaw)) {
    // Evitamos IDs raros que puedan crear paths imposibles o edge cases en el futuro.
    if (typeof pageId !== 'string' || pageId.trim() === '') {
      pushIssue(issues, {
        code: 'page_id_invalid',
        path: `pages.${String(pageId)}`,
        message: 'Page id must be a non-empty string.',
      });
      continue;
    }

    pagesOut[pageId] = normalizePage(pageValue, issues, `pages.${pageId}`);
  }

  // Garantía fuerte: siempre al menos una página.
  if (Object.keys(pagesOut).length === 0) {
    pagesOut.home = [];
  }

  const normalizedConfig: LandmakerConfig = { pages: pagesOut };

  const valid = !issues.some((i) => i.severity === 'error');
  return { valid, issues, normalizedConfig };
}
