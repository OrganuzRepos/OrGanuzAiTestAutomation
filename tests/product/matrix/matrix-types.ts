/**
 * Product-matrix domain types. The definitions were hoisted to `src/types` so the product
 * page objects (`src/pages/product/*`) can depend on them without importing from `tests/`.
 * This file re-exports them so the matrix data/contract specs keep their `./matrix-types`
 * imports — the repo's "old paths re-export" convention (see CLAUDE.md → src/types).
 */
export * from '../../../src/types/productMatrix.types';
