import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { publishFromErp } from "@/lib/products";
import { api, type Product } from "@/lib/api";

const erpProductSchema = zodProductSchema;

export function ErpProductsNewPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    position: "0%",
    imageUrl: "",
  });

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const parsed = erpProductSchema.parse(form);
      await publishFromErp({ ...parsed, status: "active", visible: true });
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
        <h2>Add a product</h2>
        <p>
          Enter the details for the new product. It is published to "Our cakes" on the next
          synchronisation.
        </p>
      </div>

      <form className="form-layout" onSubmit={submit}>
        <div className="order-aside">
          <span className="sticker">PRODUCT DETAILS</span>
          <h2>New product entry</h2>
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
