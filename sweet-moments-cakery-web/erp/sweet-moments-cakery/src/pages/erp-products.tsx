import { useEffect, useState } from "react";
import { Plus, Trash2, Edit3, Eye, EyeOff, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type Product } from "@/lib/api";

export function ErpProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get<Product[]>("/erp/products")
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load products");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = products.filter((p) => {
    if (filter === "active") return p.status === "active";
    if (filter === "archived") return p.status === "archived";
    return true;
  });

  return (
    <section className="section">
      <div className="section-title">
        <span className="sticker">ERP / PRODUCT CATALOGUE</span>
        <h2>Product catalogue</h2>
        <p>
          The back office for the public catalogue. Add, edit and archive items, then preview them
          below. Published items appear on the website under "Our cakes" within the next
          synchronisation cycle.
        </p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="category-tabs">
        {(["all", "active", "archived"] as const).map((v) => (
          <Button
            key={v}
            variant={filter === v ? "default" : "outline"}
            className="round-cta"
            onClick={() => setFilter(v)}
          >
            {v === "all" ? "All items" : v === "active" ? "Active" : "Archived"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="product-grid">
          <div className="product-card">
            <div className="cake-photo" role="img" aria-label="Loading catalogue" />
            <p className="text-14pt text-muted-foreground">Loading products…</p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="product-grid">
          <div className="product-card">
            <div className="cake-photo" role="img" aria-label="Empty catalogue" />
            <h3 className="text-27pt">No products yet</h3>
            <p className="text-14pt text-muted-foreground">
              Add your first product using the form below so it can appear on "Our cakes".
            </p>
          </div>
        </div>
      ) : (
        <div className="product-grid">
          {rows.map((p) => (
            <article key={p.id} className="product-card">
              <div
                className="cake-photo"
                role="img"
                aria-label={p.name}
                style={{
                  backgroundImage: p.imageUrl,
                  backgroundPosition: p.position,
                }}
              />
              <h3>{p.name}</h3>
              <p className="text-14pt text-muted-foreground">{p.description}</p>
              <div className="product-bottom">
                <span>{p.category}</span>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="icon" aria-label={`Edit ${p.name}`}>
                    <a href={`/erp/products/${p.id}/edit`}>
                      <Edit3 size={14} />
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="icon" aria-label={`Preview ${p.name}`}>
                    <a href={`/erp/products/${p.id}/preview`}>
                      <Eye size={14} />
                    </a>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        asChild
                        variant="outline"
                        size="icon"
                        aria-label={`More actions for ${p.name}`}
                      >
                        <ChevronDown size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => {
                          if (p.status === "active") {
                            api.post(`/erp/products/${p.id}/archive`).catch(() => {});
                          } else {
                            api.post(`/erp/products/${p.id}/activate`).catch(() => {});
                          }
                        }}
                      >
                        {p.status === "active" ? "Archive" : "Reactivate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          api.patch(`/erp/products/${p.id}/visible`, { visible: !p.visible }).catch(() => {});
                        }}
                      >
                        <Eye size={14} />
                        {p.visible ? "Hide" : "Show"} on the website
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Delete ${p.name} from the catalogue?`)) {
                            api.delete(`/erp/products/${p.id}`).catch(() => {});
                          }
                        }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="collection-link">
        <Button asChild variant="default" className="round-cta">
          <a href="/erp/products/new">
            <Plus size={18} />
            Add product
          </a>
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Product data is stored in the ecosystem database and is copied into the public catalogue on
        the next synchronisation run.
      </p>
    </section>
  );
}

export function ErpProductsEntryPoint() {
  return (
    <>
      <h1 className="text-72px">Product catalogue</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Manage the products shown on the website.
      </p>
      <ErpProductsPage />
    </>
  );
}
