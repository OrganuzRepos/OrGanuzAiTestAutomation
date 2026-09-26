/**
 * Product-matrix domain constants (property-type labels, panel thresholds, field lists).
 * Hoisted to `src/data` so the product page objects (`src/pages/product/*`) can depend on
 * `PROPERTY_TYPE_LABELS` without importing from `tests/`. Re-exported here so the matrix
 * data/contract specs keep their `./matrix-constants` imports — the "old paths re-export"
 * convention (see CLAUDE.md → src/types).
 */
export * from '../../../src/data/productMatrix.constants';
