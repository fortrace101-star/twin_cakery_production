import { PageBanner } from "@/components/cakery/site-shell";
import { EnquiryForm } from "@/components/cakery/enquiry-form";
import { usePageMeta } from "@/lib/page-meta";
import baking from "@/assets/baking-class.jpg";

export function CoursesPage() {
  usePageMeta(
    "Baking courses",
    "Enquire about Twin Cakery baking and cake-decorating courses, from beginner bakes to creative finishing techniques.",
  );
  return (
    <>
      <PageBanner
        title="BAKE. LEARN. LOVE IT."
        description="A little flour. A little confidence. A new favourite skill."
        tag="COURSES & WORKSHOPS"
      />
      <section className="section form-layout">
        <div className="order-aside">
          <img src={baking} alt="Learn to pipe buttercream cakes" width={1024} height={768} />
          <h2>
            YOUR NEXT CHAPTER
            <br />
            STARTS IN THE KITCHEN.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Interested in baking basics, buttercream decorating, or celebration cakes? Tell us what
            you’d like to learn and your experience level.
          </p>
          <p className="empty-note">
            Course dates, fees, and available places will be announced here. Enquire below to hear
            about the next classes.
          </p>
        </div>
        <EnquiryForm kind="course" item="Baking & cake decorating courses" />
      </section>
    </>
  );
}
