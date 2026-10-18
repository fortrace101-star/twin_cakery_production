import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/cakery/site-shell";
import { usePageMeta } from "@/lib/page-meta";
import cakes from "@/assets/cake-collection.jpg";

export function OffersPage() {
  usePageMeta(
    "Offers & sweet bundles",
    "Explore celebration bundles and ask Twin Cakery about current cake and treat offers.",
  );
  return (
    <>
      <PageBanner
        title="MORE SWEETNESS TO SHARE."
        description="A little extra joy for your next celebration."
        tag="OFFERS & BUNDLES"
      />
      <section className="section story-grid">
        <img src={cakes} alt="Cakes for your next celebration" width={1536} height={768} />
        <div>
          <span className="sticker">MAKE IT A CELEBRATION</span>
          <h2>
            ONE OCCASION.
            <br />
            SO MANY SWEET IDEAS.
          </h2>
          <p>
            Planning a party or treating a crowd? Ask us about pairing your celebration cake with
            cupcakes and other sweet treats.
          </p>
          <p>
            Current promotions and bundle pricing will be confirmed when you enquire. No fixed-price
            offers are currently listed.
          </p>
          <Button asChild className="round-cta">
            <Link to="/order?cake=Celebration%20cake%20%26%20cupcake%20bundle">
              Enquire about a bundle
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
