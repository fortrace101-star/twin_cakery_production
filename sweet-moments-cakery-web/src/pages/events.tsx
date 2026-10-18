import { PageBanner } from "@/components/cakery/site-shell";
import { usePageMeta } from "@/lib/page-meta";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Clock, ArrowUpRight, Mail } from "lucide-react";

export function EventsPage() {
  usePageMeta(
    "Upcoming events",
    "Stay in touch for Twin Cakery's upcoming cake tastings, baking experiences and special events.",
  );

  const upcoming = [
    {
      season: "MAY",
      item: "Small group cake tasting",
      detail: "Private evening of tasting and choosing your next celebration cake.",
    },
    {
      season: "AUG",
      item: "Hands-on buttercream class",
      detail: "Four hands-on hours covering crumb coating, borders and rosettes.",
    },
    {
      season: "OCT",
      item: "Halloween sweets fair",
      detail: "Trick-or-treat boxes and Halloween treats, with a portion for the kitchen.",
    },
  ];

  return (
    <>
      <PageBanner
        title="Upcoming events"
        description="Stay in touch for Twin Cakery's upcoming cake tastings, baking experiences and special events."
        tag="UPCOMING EVENTS"
      />
      <section className="section">
        <div className="section-title">
          <span className="sticker">WATCH THIS SPACE</span>
          <h2>
            SOMETHING SWEET
            <br />
            TO LOOK FORWARD TO.
          </h2>
          <p>
            Our next events are being prepared. Leave an enquiry to hear about future cake tastings,
            workshops, and Twin Cakery gatherings.
          </p>
        </div>
        <div className="event-grid">
          {upcoming.map((event) => (
            <article key={event.season + event.item} className="event-card">
              <span className="event-season">{event.season}</span>
              <h3>{event.item}</h3>
              <p>{event.detail}</p>
              <Link to="/events?enquire=true" className="event-link">
                Enquire about this
                <ArrowUpRight />
              </Link>
            </article>
          ))}
        </div>
        <p className="empty-note">
          No events are currently announced. Confirmed dates and booking details will appear here.
        </p>
        <div className="contact-row">
          <Mail className="inline mr-2 h-4 w-4 shrink-0" />
          <span>
            For updates, leave a message or connect on WhatsApp and we will let you know when dates
            are confirmed.
          </span>
        </div>
      </section>
    </>
  );
}
