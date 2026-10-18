  export type CatalogueType = {
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
  };

  export type CatalogueProduct = {
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
  };

  export type CatalogueProductInput = {
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
  };

  // ---------------------------------------------------------------------------
  // Catalogue (public products catalogue)
  // ---------------------------------------------------------------------------

  catalogueProducts(): CatalogueProduct[] {
    return this.db.catalogue?.products ?? [];
  }

  catalogueCategories(): CatalogueCategory[] {
    return this.db.catalogue?.categories ?? [];
  }

  catalogueTypes(): CatalogueType[] {
    return this.db.catalogue?.types ?? [];
  }

  createProduct(input: CatalogueProductInput): CatalogueProduct {
    const now = new Date().toISOString();
    const product: CatalogueProduct = {
      id: input.id ?? makeId("prod"),
      sku: input.sku ?? "",
      categoryId: input.categoryId ?? "",
      productTypeId: input.productTypeId ?? "",
      name: input.name ?? "",
      description: input.description ?? "",
      basePrice: input.basePrice ?? 0,
      currency: input.currency ?? "UGX",
      costReference: input.costReference ?? "",
      catalogueVisible: input.catalogueVisible ?? true,
      productionEnabled: input.productionEnabled ?? true,
      image: input.image ?? "",
      active: input.active ?? true,
      archived: input.archived ?? false,
      notes: input.notes ?? "",
      created_at: input.createdAt ?? now,
      updated_at: now,
    };
    this.db.catalogue = {
      ...this.db.catalogue,
      products: [...(this.db.catalogue?.products ?? []), product],
    };
    this.db.persist();
    return product;
  }

  updateProduct(id: string, patch: Partial<Omit<CatalogueProduct, "id">>): CatalogueProduct | undefined {
    const products = this.catalogueProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    const product = products[idx];
    const next: CatalogueProduct = { ...product, ...patch, updated_at: new Date().toISOString() };
    this.db.catalogue = {
      ...this.db.catalogue,
      products: products.map((p, i) => (i === idx ? next : p)),
    };
    this.db.persist();
    return next;
  }

  archiveProduct(id: string): boolean {
    const product = this.catalogueProducts().find((p) => p.id === id);
    if (!product) return false;
    this.updateProduct(id, { archived: true, active: false });
    return true;
  }

  activateProduct(id: string): boolean {
    const product = this.catalogueProducts().find((p) => p.id === id);
    if (!product) return false;
    this.updateProduct(id, { archived: false, active: true });
    return true;
  }

  deleteProduct(id: string): boolean {
    const products = this.catalogueProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.db.catalogue = {
      ...this.db.catalogue,
      products: products.filter((_, i) => i !== idx),
    };
    this.db.persist();
    return true;
  }

  listProducts(params?: { active?: boolean; visible?: boolean; search?: string }): CatalogueProduct[] {
    let list = this.catalogueProducts();
    if (params?.active !== undefined) list = list.filter((p) => p.active === params.active);
    if (params?.visible !== undefined) list = list.filter((p) => p.catalogueVisible === params.visible);
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }
    return list;
  }

  getProduct(id: string): CatalogueProduct | undefined {
    return this.catalogueProducts().find((p) => p.id === id);
  }
}
