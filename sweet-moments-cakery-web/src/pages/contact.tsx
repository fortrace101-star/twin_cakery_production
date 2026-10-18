import { PageBanner } from "@/components/cakery/site-shell";
import { EnquiryForm } from "@/components/cakery/enquiry-form";
import { usePageMeta } from "@/lib/page-meta";

export function ContactPage() {
  usePageMeta(
    "Contact us",
    "Contact Twin Cakery with cake questions, course enquiries or plans for your next celebration.",
  );
  return (
    <>
      <PageBanner
        title="LET’S TALK SOMETHING SWEET."
        description="Questions, ideas, or a celebration in mind? We’d love to hear from you."
      />
      <section className="section form-layout">
        <div className="order-aside">
          <span className="sticker">SAY HELLO</span>
          <h2>
            A LITTLE CONVERSATION.
            <br />A SWEET BEGINNING.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Send your message and the Twin Cakery team can reply using the email or phone number you
            provide.
          </p>
          <p className="empty-note">
            For cake orders, include your occasion, preferred date, number of guests, and any
            dietary needs.
          </p>
        </div>
        <EnquiryForm kind="contact" item="General enquiry" />
      </section>
    </>
  );
}
