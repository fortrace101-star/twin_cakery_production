import { useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enquirySchema } from "@/lib/cakery";
export function EnquiryForm({
  kind = "cake",
  item = "Custom celebration cake",
}: {
  kind?: "cake" | "course" | "event" | "contact";
  item?: string;
}) {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = enquirySchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      kind,
      item: form.get("item"),
      preferred_date: form.get("preferred_date") || undefined,
      message: form.get("message"),
    });
    if (!parsed.success) {
      setError("Please check your details and enter a valid email and phone number.");
      return;
    }
    setError("");
    if (kind === "cake") {
      const details = [
        `Name: ${parsed.data.name}`,
        `Email: ${parsed.data.email}`,
        `Phone: ${parsed.data.phone}`,
        `Order: ${parsed.data.item}`,
        parsed.data.preferred_date ? `Preferred date: ${parsed.data.preferred_date}` : "",
        parsed.data.message ? `Details: ${parsed.data.message}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const url = `https://wa.me/256700935916?text=${encodeURIComponent(`Hello Twin Cakery! I would like to place an order.\n\n${details}`)}`;
      window.open(url, "_blank", "noopener");
      setWhatsappUrl(url);
    }
    setSent(true);
  }
  if (sent)
    return (
      <div className="enquiry-form success-state" role="status">
        <CheckCircle2 size={45} />
        <h2>A SWEET START!</h2>
        <p>
          {kind === "cake"
            ? "Your order details are ready to send."
            : "Thanks for reaching out — we’ll be in touch soon."}
        </p>
        {kind === "cake" && (
          <p className="text-sm text-muted-foreground mt-4">
            WhatsApp should have opened with your order details — press send there and we’ll reply
            with availability and pricing.
          </p>
        )}
        {whatsappUrl && (
          <Button asChild className="round-cta w-full mt-4">
            <a href={whatsappUrl} target="_blank" rel="noopener">
              Continue on WhatsApp
            </a>
          </Button>
        )}
        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          Final pricing and availability will be confirmed with you before any payment.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setSent(false);
            setWhatsappUrl("");
          }}
        >
          Send another request
        </Button>
      </div>
    );
  return (
    <form className="enquiry-form" onSubmit={submit}>
      <h2>{kind === "cake" ? "LET’S MAKE IT SPECIAL" : "LET’S TALK"}</h2>
      <label className="field">
        Your name
        <input
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          placeholder="Full name"
        />
      </label>
      <div className="field-row">
        <label className="field">
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={255}
            placeholder="you@example.com"
          />
        </label>
        <label className="field">
          Phone number
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            minLength={6}
            maxLength={30}
            placeholder="Your phone number"
          />
        </label>
      </div>
      <label className="field">
        {kind === "cake" ? "What would you like?" : "I’m interested in"}
        <select name="item" defaultValue={item}>
          {[
            item,
            ...(kind === "cake"
              ? [
                  "Custom celebration cake",
                  "Strawberry Bliss",
                  "Chocolate Dream",
                  "Vanilla Celebration",
                  "Red Velvet Love",
                  "Wedding cake",
                  "Cupcake box",
                ]
              : []),
          ]
            .filter((v, i, a) => a.indexOf(v) === i)
            .map((v) => (
              <option key={v}>{v}</option>
            ))}
        </select>
      </label>
      {kind === "cake" && (
        <label className="field">
          Preferred date
          <input name="preferred_date" type="date" required />
        </label>
      )}
      <label className="field">
        {kind === "cake" ? "Tell us about your cake" : "Your message"}
        <textarea
          name="message"
          maxLength={2000}
          placeholder={
            kind === "cake"
              ? "Occasion, number of guests, flavours, design ideas, and any allergies…"
              : "What would you like to know?"
          }
        />
      </label>
      {error && (
        <p role="alert" className="text-destructive text-sm mb-4">
          {error}
        </p>
      )}
      <Button type="submit" className="round-cta w-full">
        {kind === "cake" ? "Send order request" : "Send enquiry"}
        <ArrowRight />
      </Button>
      <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
        Final pricing and availability will be confirmed with you before any payment.
      </p>
    </form>
  );
}
