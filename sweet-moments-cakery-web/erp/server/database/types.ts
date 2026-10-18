export interface CatalogueCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  image: string;
  displayOrder: number;
  active: boolean;
  catalogueVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogueType {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  description: string;
  displayOrder: number;
  active: boolean;
  catalogueVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogueProduct {
  id: string;
  sku: string;
  categoryId: string;
  productTypeId: string;
  name: string;
  description: string;
  basePrice: number;
  currency: string;
  costReference: string;
  catalogueVisible: boolean;
  productionEnabled: boolean;
  image: string;
  active: boolean;
  archived: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogueProductInput {
  id?: string;
  sku?: string;
  categoryId?: string;
  productTypeId?: string;
  name?: string;
  description?: string;
  basePrice?: number;
  currency?: string;
  costReference?: string;
  catalogueVisible?: boolean;
  productionEnabled?: boolean;
  image?: string;
  active?: boolean;
  archived?: boolean;
  notes?: string;
  createdAt?: string;
}
