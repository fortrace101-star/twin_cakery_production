import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/cakery/site-shell";
import { usePageMeta } from "@/lib/page-meta";
import baking from "@/assets/baking-class.jpg";

export function AboutPage() {
  usePageMeta(
    "Our story",
    "Meet Twin Cakery, where creativity and care come together in beautiful cakes and shared baking experiences.",
  );
  return (
    <>
      <PageBanner title="A WHOLE LOT OF HEART." description="The love behind every layer." />
      <section className="section story-grid">
        <img
          src={baking}
          alt="Carefully piping a Twin Cakery-inspired cake"
          width={1024}
          height={768}
        />
        <div>
          <span className="sticker">HELLO, WE’RE TWIN CAKERY</span>
          <h2>
            SWEET MOMENTS.
            <br />
            THOUGHTFULLY MADE.
          </h2>
          <p>
            We believe the best celebrations are personal. A favourite flavour, a thoughtful design,
            a cake that makes someone smile — it’s the little details that matter.
          </p>
          <p>
            Our kitchen is a place for creativity, celebration, and sharing the joy of baking.
            Whether you’re ordering a cake or enquiring about a class, we’d love to hear from you.
          </p>
          <Button asChild className="round-cta">
            <Link to="/contact">Say hello</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
