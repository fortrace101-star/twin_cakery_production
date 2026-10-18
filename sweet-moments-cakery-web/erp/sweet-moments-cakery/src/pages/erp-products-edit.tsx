import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit3, ArrowLeft } from "lucide-react";
import { api, type Product } from "@/lib/api";

const erpProductSchema = zodProductSchema;

export function ErpProductsEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    position: "0%",
    imageUrl: "",
    visible: true,
  });

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    api
      .get<Product[]>("/erp/products")
      .then((data) => {
        const product = data.find((p) => p.id === id);
        if (!cancelled && product) {
          setForm({
            name: product.name,
            category: product.category,
            description: product.description,
            position: product.position,
            imageUrl: product.imageUrl ?? "",
            visible: product.visible,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load product");
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
          <h2>Edit product</h2>
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

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const parsed = erpProductSchema.parse(form);
      const patch: any = {
        name: parsed.name,
        category: parsed.category,
        description: parsed.description,
        position: parsed.position,
        imageUrl: parsed.imageUrl,
        status: parsed.visible ? "active" : "archived",
        catalogueVisible: parsed.visible,
      };
      await api.patch(`/erp/products/${id}`, patch);
      await api.get<Product[]>("/erp/products");
      navigate("/erp/products");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the product. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section">
      <div className="section-title">
        <span className="sticker">ERP / PRODUCT CATALOGUE</span>
        <h2>Edit product</h2>
        <p>
          Update the details for the product. Changes are published to "Our cakes" on the next
          synchronisation.
        </p>
      </div>

      <form className="form-layout" onSubmit={submit}>
        <div className="order-aside">
          <span className="sticker">PRODUCT DETAILS</span>
          <h2>Edit product</h2>
          <p className="text-muted-foreground text-sm">
            All fields are required unless marked optional. The position percentage controls where
            the product sits in the "Our cakes" grid.
          </p>
        </div>

        <div className="enquiry-form">
          {error && <p className="form-message">{error}</p>}
          <div className="field">
            <Label htmlFor="name">Product name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Strawberry Bliss"
            />
          </div>
          <div className="field-row">
            <div className="field">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                placeholder="Celebration cakes"
              />
            </div>
            <div className="field">
              <Label htmlFor="position">Grid position</Label>
              <Input
                id="position"
                value={form.position}
                onChange={(e) => update("position", e.target.value)}
                placeholder="0%"
              />
            </div>
          </div>
          <div className="field">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              placeholder="Soft layers. Fresh berries. Pure happiness."
            />
          </div>
          <div className="field">
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input
              id="imageUrl"
              value={form.imageUrl}
              onChange={(e) => update("imageUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="field">
            <Label htmlFor="visible">Show on website</Label>
            <Input
              id="visible"
              type="checkbox"
              checked={form.visible}
              onChange={(e) => update("visible", e.target.checked)}
            />
          </div>
          <div className="flex gap-2">
            <Button asChild type="submit" className="round-cta" disabled={saving}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                {saving ? "Saving…" : "Save product"}
                <span aria-hidden="true">→</span>
              </span>
            </Button>
            <Button asChild variant="outline">
              <a href="/erp/products">Cancel</a>
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
