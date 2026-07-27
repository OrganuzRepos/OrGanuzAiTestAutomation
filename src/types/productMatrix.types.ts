export type ProductPersonaId = 'customer' | 'consultant' | 'company' | 'company-employee';
export type ArenaType = 'ARENA_TYPE_MAIN' | 'ARENA_TYPE_RAMOT';
export type PropertyType =
  | 'PROPERTY_TYPE_PRIVATE_HOUSE'
  | 'PROPERTY_TYPE_BUILDING'
  | 'PROPERTY_TYPE_COMMERCIAL'
  | 'PROPERTY_TYPE_AGRICULTURAL'
  | 'PROPERTY_TYPE_PUBLIC';
export type PolygonType = 'building' | 'parking' | 'sports-court';
export type RoofSurfaceType = 'concrete' | 'tiles' | 'iscoverit' | 'parking' | 'sports-court';
export type PanelMode = 'quotable' | 'below-minimum' | 'none';

export interface ProductPersona {
  readonly id: ProductPersonaId;
  readonly name: string;
  readonly role: string;
  readonly expectedPostFundingDestination: 'quotations' | 'results';
  readonly canOpenQuotationsFromResults: boolean;
  readonly canOpenCompanyPricing: boolean;
  readonly canOpenCompanyManagement: boolean;
}

export interface PropertyCharacterizationData {
  readonly id: string;
  readonly arenaType: ArenaType;
  readonly address: string;
  readonly propertyType: PropertyType;
  readonly polygons: readonly PolygonType[];
  readonly roofSurfaces: readonly RoofSurfaceType[];
  readonly panelMode: PanelMode;
  readonly minimumPanelCount: number;
  readonly wantFinancingOffer: boolean;
  readonly expectedBehavior: string;
  readonly skipsObjectAndRoofSteps: boolean;
  readonly onlyBuildingAreaCanBeMarked: boolean;
  readonly roofState?: Record<string, unknown>;
  readonly roofObjects?: Record<string, unknown>;
  readonly roofLevels?: Record<string, unknown>;
}
