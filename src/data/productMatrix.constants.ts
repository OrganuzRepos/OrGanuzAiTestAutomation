import type { PropertyType, PolygonType, RoofSurfaceType } from '../types/productMatrix.types';

export const PROPERTY_TYPES: readonly PropertyType[] = [
  'PROPERTY_TYPE_PRIVATE_HOUSE',
  'PROPERTY_TYPE_BUILDING',
  'PROPERTY_TYPE_COMMERCIAL',
  'PROPERTY_TYPE_AGRICULTURAL',
  'PROPERTY_TYPE_PUBLIC',
] as const;

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  PROPERTY_TYPE_PRIVATE_HOUSE: 'בית פרטי',
  PROPERTY_TYPE_BUILDING: 'בניין מגורים',
  PROPERTY_TYPE_COMMERCIAL: 'מבנה מסחרי',
  PROPERTY_TYPE_AGRICULTURAL: 'מבנה חקלאי',
  PROPERTY_TYPE_PUBLIC: 'מבנה ציבורי',
};

export const POLYGON_TYPES: readonly PolygonType[] = ['building', 'parking', 'sports-court'] as const;

export const ROOF_SURFACE_TYPES: readonly RoofSurfaceType[] = [
  'concrete',
  'tiles',
  'iscoverit',
  'parking',
  'sports-court',
] as const;

export const RUNTIME_ONLY_FIELDS = [
  'projectId',
  'quotationId',
  'entrepreneurQuotationId',
  'token',
] as const;

/**
 * Business rule: a roof needs at least this many panels to produce a quotable
 * result. `quotable` scenarios sit at or above it; `below-minimum` scenarios sit
 * under it. Kept here (not inline in the spec) so the threshold has one home.
 */
export const QUOTABLE_MINIMUM_PANEL_COUNT = 5;
