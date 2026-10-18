import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Product } from "@/lib/api";

export function ErpProductsPreviewPage() {
  const { id } = useParams();
  const [preview, setPreview] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    api
      .get<Product[]>("/erp/products")
      .then((data) => {
        if (!cancelled) setPreview(data.find((p) => p.id === id) ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load product");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <section className="section">
        <div className="section-title">
          <span className="sticker">ERP / PRODUCT CATALOGUE</span>
          <h2>Preview not found</h2>
          <p className="text-muted-foreground text-sm">No product selected.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <a href="/erp/products">
              <ArrowLeft size={18} />
              Back to catalogue
            </a>
          </Button>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="section">
        <div className="section-title">
          <span className="sticker">ERP / PRODUCT CATALOGUE</span>
          <h2>Preview</h2>
          <p className="text-muted-foreground text-sm">Loading product…</p>
        </div>
        <div className="collection-link">
          <Button asChild variant="outline">
            <a href="/erp/products">
              <ArrowLeft size={18} />
              Back to catalogue
            </a>
          </Button>
        </div>
      </section>
    );
  }

  if (error || !preview) {
    return (
      <section className="section">
        <div className="section-title">
          <span className="sticker">ERP / PRODUCT CATALOGUE</span>
          <h2>Preview not found</h2>
          <p className="text-muted-foreground text-sm">{error ?? "No product found."}</p>
        </div>
        <div className="collection-link">
          <Button asChild variant="outline">
            <a href="/erp/products">
              <ArrowLeft size={18} />
              Back to catalogue
            </a>
          </Button>
        </div>
      </section>
    );
  }

  function toggleVisible() {
    api
      .patch(`/erp/products/${preview.id}/visible`, { visible: !preview.visible })
      .then((res: any) => setPreview({ ...preview, visible: res.visible }))
      .catch(() => {});
  }

  return (
    <section className="section">
      <div className="section-title">
        <span className="sticker">ERP / PRODUCT CATALOGUE</span>
        <h2>Preview</h2>
        <p>
          See how the product renders on the website before you publish your changes.
        </p>
      </div>

      <div className="product-card">
        <div
          className="cake-photo"
          role="img"
          aria-label={preview.name}
          style={{
            backgroundImage: preview.imageUrl ?? undefined,
            backgroundPosition: preview.position,
          }}
        />
        <div className="product-card-content">
          <h3>{preview.name}</h3>
          <p className="text-14pt text-muted-foreground">{preview.description}</p>
          <div className="product-bottom">
            <span>{preview.category}</span>
            <div className="flex gap-2">
              <span className="text-13pt">
                Visible: {preview.visible ? "Yes" : "No"}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleVisible}
                aria-label={preview.visible ? "Hide on website" : "Show on website"}
              >
                {preview.visible ? <Eye size={14} /> : <X size={14} />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="collection-link">
        <Button asChild variant="outline">
          <a href="/erp/products">
            <ArrowLeft size={18} />
            Back to catalogue
          </a>
        </Button>
      </div>
    </section>
  );
}
