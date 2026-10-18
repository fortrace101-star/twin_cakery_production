import { PageBanner } from "@/components/cakery/site-shell";
import { Products } from "@/components/cakery/products";
import { usePageMeta } from "@/lib/page-meta";

export function CakesPage() {
  usePageMeta(
    "Our cakes",
    "Explore made-to-order celebration cakes, wedding cakes and sweet treats at Twin Cakery.",
  );
  return (
    <>
      <PageBanner title="OUR CAKES" description="Every celebration deserves a little sweetness." />
      <Products full />
      <div className="section pt-0">
        <p className="empty-note">
          Every cake is made to order. Tell us your preferred flavours, design, size, and any
          allergies when you request a quote. Photos are illustrative; your cake will be tailored to
          you.
        </p>
      </div>
    </>
  );
}
