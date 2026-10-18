import { Link } from "react-router-dom";
import { ArrowUpRight, Heart, Sparkles, CakeSlice, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Products } from "@/components/cakery/products";
import { usePageMeta } from "@/lib/page-meta";
import hero from "@/assets/bakery-hero.jpg";
import baking from "@/assets/baking-class.jpg";
import cakes from "@/assets/cake-collection.jpg";

export function HomePage() {
  usePageMeta(
    "Cakes, celebrations & a little happiness",
    "Discover Twin Cakery’s made-to-order cakes, sweet treats, baking courses and upcoming events.",
  );
  return (
    <>
      <section className="hero">
        <img
          className="hero-photo"
          src={hero}
          alt="Freshly baked croissants, cinnamon rolls and strawberry pastries"
          width={1536}
          height={1024}
        />
        <div className="hero-content">
          <span className="eyebrow text-primary">A LITTLE SUGAR. A WHOLE LOT OF HEART.</span>
          <p className="hero-tagline display">
            DOUBLE THE LOVE.
            <br />
            EVERY SINGLE BITE.
          </p>
          <p className="hero-copy">
            Beautiful cakes, irresistible treats, and sweet memories.
            <br />
            Handcrafted with love, just for you.
          </p>
          <div className="hero-actions">
            <Button asChild className="round-cta">
              <Link to="/cakes">
                Explore our cakes
                <ArrowUpRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="round-cta">
              <Link to="/order">Order something special</Link>
            </Button>
          </div>
          <div className="hero-bottom">
            <span>
              <Heart size={14} />
              Made with love
            </span>
            <span>
              <Sparkles size={14} />
              Freshly baked
            </span>
            <span>
              <CakeSlice size={14} />
              Your occasion, your cake
            </span>
          </div>
        </div>
      </section>
      <div className="ticker" aria-hidden="true">
        <span>BAKED WITH LOVE</span>
        <Star />
        <span>A LITTLE SLICE OF JOY</span>
        <Star />
        <span>MADE FOR YOUR MOMENTS</span>
        <Star />
        <span>BAKED WITH LOVE</span>
        <Star />
        <span>A LITTLE SLICE OF JOY</span>
      </div>
      <Products />
      <section className="story-band">
        <div className="section story-grid">
          <img
            src={baking}
            alt="A baker carefully decorating a celebration cake"
            width={1024}
            height={768}
            loading="lazy"
          />
          <div>
            <span className="sticker">THE HEART BEHIND THE CAKES</span>
            <h2>
              MORE THAN CAKE.
              <br />
              IT’S A LITTLE LOVE.
            </h2>
            <p>
              There’s something special about a cake made just for you. At Twin Cakery, we bring a
              little creativity, a little care, and a whole lot of love to every celebration.
            </p>
            <Button asChild variant="outline" className="round-cta">
              <Link to="/about">
                Meet Twin Cakery
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-title">
          <span className="sticker">THERE’S MORE TO LOVE</span>
          <h2>
            COME FOR THE CAKE.
            <br />
            STAY FOR THE EXPERIENCE.
          </h2>
        </div>
        <div className="feature-grid">
          <article className="feature">
            <img
              src={baking}
              alt="Hands-on cake decorating"
              width={1024}
              height={768}
              loading="lazy"
            />
            <span className="eyebrow text-primary">LEARN WITH US</span>
            <h3>
              FROM YOUR FIRST BAKE
              <br />
              TO YOUR NEXT BIG THING.
            </h3>
            <p>Bring your curiosity. Discover the joy of baking and decorating with Twin Cakery.</p>
            <Button asChild className="round-cta">
              <Link to="/courses">
                Explore courses
                <ArrowUpRight />
              </Link>
            </Button>
          </article>
          <article className="feature">
            <img
              src={cakes}
              alt="A selection of celebration cakes"
              width={1536}
              height={768}
              loading="lazy"
            />
            <span className="eyebrow text-primary">SWEET THINGS AHEAD</span>
            <h3>
              LET’S MAKE
              <br />
              SOME MEMORIES.
            </h3>
            <p>
              Cake tastings, baking experiences, and moments worth sharing. Find out what’s coming.
            </p>
            <Button asChild className="round-cta">
              <Link to="/events">
                Upcoming events
                <ArrowUpRight />
              </Link>
            </Button>
          </article>
        </div>
      </section>
    </>
  );
}
