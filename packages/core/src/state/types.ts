/*
  Landmaker - Project State (ETAPA 1)

  Este módulo define el contrato de tipos para el sistema interno de estado.

  PRINCIPIO CENTRAL
  - landmaker.config.json es la fuente de verdad absoluta del constructor.
  - El sitio (Astro, archivos en /src/pages, etc.) NO es la fuente de verdad.

  Por qué:
  - El filesystem es mutable por actores externos (editores, merges, scripts, errores humanos).
  - Los archivos del sitio pueden ser regenerados, reordenados o cacheados.
  - Un único archivo de estado facilita:
    - validación consistente
    - migraciones
    - normalización
    - operaciones atómicas de guardado (evitar corrupción)

  Nota:
  - Estos tipos no asumen estructura interna de una sección.
  - Solo se definen invariantes mínimas requeridas por esta etapa.
*/

export const LANDMAKER_CONFIG_FILE = 'landmaker.config.json' as const;

export type PageId = string;

/**
 * Sección mínima válida.
 *
 * Importante:
 * - No definimos más propiedades para no acoplar el core a la UI o al render.
 * - Permitimos campos adicionales para que el sistema evolucione sin romper.
 */
export type LandmakerSection = {
  type: string;
  variant: number;
  theme?: string;
  [key: string]: unknown;
};

export type LandmakerPage = LandmakerSection[];

/**
 * Config de Landmaker (fuente de verdad).
 *
 * Invariante clave:
 * - pages siempre existe.
 * - cada valor de pages es un array (una página = lista de secciones).
 */
export type LandmakerConfig = {
  pages: Record<PageId, LandmakerPage>;
};

export type ValidationIssueSeverity = 'error' | 'warn';

export type ValidationIssueCode =
  | 'config_not_object'
  | 'pages_missing'
  | 'pages_not_object'
  | 'page_id_invalid'
  | 'page_not_array'
  | 'section_not_object'
  | 'section_type_missing'
  | 'section_type_invalid'
  | 'section_variant_missing'
  | 'section_variant_invalid'
  | 'section_theme_invalid';

export type ValidationIssue = {
  code: ValidationIssueCode;
  severity: ValidationIssueSeverity;
  path: string;
  message: string;
};

/**
 * Resultado de validación.
 *
 * IMPORTANTE: normalize siempre produce un config usable.
 * Por eso, además de issues, devolvemos normalizedConfig.
 */
export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  normalizedConfig: LandmakerConfig;
};
