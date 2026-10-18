import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { PageBanner } from "@/components/cakery/site-shell";
import { EnquiryForm } from "@/components/cakery/enquiry-form";
import { usePageMeta } from "@/lib/page-meta";
import cakes from "@/assets/cake-collection.jpg";

const orderSearchSchema = z.object({ cake: z.string().max(150).optional() });

export function OrderPage() {
  usePageMeta(
    "Order a cake",
    "Request a custom cake from Twin Cakery. Share your occasion, design ideas and preferred date for a personal quote.",
  );
  const [searchParams] = useSearchParams();
  const parsed = orderSearchSchema.safeParse({
    cake: searchParams.get("cake") ?? undefined,
  });
  const cake = parsed.success ? parsed.data.cake : undefined;

  return (
    <>
      <PageBanner
        title="YOUR MOMENT. YOUR CAKE."
        description="Tell us what you’re celebrating. We’ll take care of the sweet part."
      />
      <section className="section form-layout">
        <div className="order-aside">
          <span className="sticker">MADE JUST FOR YOU</span>
          <h2>
            LET’S BAKE
            <br />A HAPPY MEMORY.
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            From birthday wishes to wedding days, we’d love to be part of your celebration. Share
            your ideas and we’ll get back to you with availability and pricing.
          </p>
          <img src={cakes} alt="Custom cake inspiration" width={1536} height={768} />
          <p className="empty-note">
            Please include any food allergies or dietary requirements. Sending a request opens
            WhatsApp so you can send the order to us directly — it does not confirm an order or
            require payment.
          </p>
        </div>
        <EnquiryForm key={cake} item={cake ?? "Custom celebration cake"} />
      </section>
    </>
  );
}
