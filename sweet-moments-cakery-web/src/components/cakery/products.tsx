import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCatalogue } from "@/hooks/use-catalogue";
import cakeImage from "@/assets/cake-collection.jpg";

export function Products({ full = false }: { full?: boolean }) {
  const { products: catalogue, source, error, syncing } = useCatalogue();
  const [category, setCategory] = useState("All cakes");

  // Categories come from the ERP, so build the tabs from whatever is live
  // instead of a hard-coded list that would hide freshly synced rows.
  const tabs = useMemo(
    () => ["All cakes", ...Array.from(new Set(catalogue.map((p) => p.category)))],
    [catalogue],
  );
  const activeCategory = tabs.includes(category) ? category : "All cakes";
  const visible =
    activeCategory === "All cakes"
      ? catalogue
      : catalogue.filter((c) => c.category === activeCategory);

  return (
    <section className="section">
      <div className="section-title">
        <span className="sticker">FRESH FROM OUR KITCHEN</span>
        <h2>A SLICE OF HAPPINESS</h2>
        <p>For the big celebrations. And the just-because moments.</p>
        {source === "seed" && (
          <p className="empty-note">
            {error
              ? `The live catalogue could not be reached, so we are showing our starter menu instead (${error}).`
              : "Showing our starter menu while the live catalogue loads."}
          </p>
        )}
      </div>
      <div className="category-tabs">
        {tabs.map((v) => (
          <Button
            key={v}
            variant={activeCategory === v ? "default" : "outline"}
            className="round-cta"
            onClick={() => setCategory(v)}
          >
            {v}
          </Button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="empty-note">
          {syncing
            ? "Loading today's bakes…"
            : "No cakes are published right now. Check back soon, or request a quote for a custom design."}
        </p>
      ) : (
        <div className="product-grid">
          {visible.map((c) => (
            <article key={c.id} className="product-card">
              <div
                className="cake-photo"
                role="img"
                aria-label={c.name}
                style={{ backgroundImage: `url(${cakeImage})`, backgroundPosition: c.position }}
              />
              <h3>{c.name}</h3>
              <p>{c.description}</p>
              <div className="product-bottom">
                <span>Made to order</span>
                <Button asChild variant="outline" size="icon" aria-label={`Order ${c.name}`}>
                  <Link to={`/order?cake=${encodeURIComponent(c.name)}`}>
                    <Plus />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {!full && (
        <div className="collection-link">
          <Button asChild variant="link">
            <Link to="/cakes">
              Explore our cakes
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
