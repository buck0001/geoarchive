import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { ArrowRight, Camera, MapPin, Sparkles } from "lucide-react";
import everestPhoto from "@/assets/welcome/everest.webp";
import eiffelPhoto from "@/assets/welcome/eiffel.webp";
import zumaPhoto from "@/assets/welcome/zuma-rock.webp";

type Example = {
  id: string;
  src: typeof everestPhoto;
  alt: string;
  place: string;
  note: string;
  tilt: string;
  delay: string;
  floatDelay: string;
};

const EXAMPLES: Example[] = [
  {
    id: "everest",
    src: everestPhoto,
    alt: "Snow-covered Everest summit under a deep blue morning sky",
    place: "Mount Everest",
    note: "Three flights and one very long walk. Worth it.",
    tilt: "-4deg",
    delay: "40ms",
    floatDelay: "-120ms",
  },
  {
    id: "eiffel",
    src: eiffelPhoto,
    alt: "Morning joggers on a bridge with the Eiffel Tower rising behind them",
    place: "Eiffel Tower",
    note: "6:41am joggers own it before the crowds wake up.",
    tilt: "2.5deg",
    delay: "150ms",
    floatDelay: "-840ms",
  },
  {
    id: "zuma",
    src: zumaPhoto,
    alt: "Zuma Rock rising above golden savannah grass in Nigeria with an ostrich in the foreground",
    place: "Zuma Rock",
    note: "An ostrich wandered into frame. Best tour guide ever.",
    tilt: "-3deg",
    delay: "260ms",
    floatDelay: "-460ms",
  },
];

export default function WelcomeHero() {
  return (
    <>
      <section className="welcome-hero">
        <div className="welcome-hero-copy">
          <p className="eyebrow welcome-eyebrow">
            <span className="eyebrow-spark">
              <Sparkles size={14} />
            </span>{" "}
            A LITTLE ARCHIVE FOR EVERYWHERE
          </p>
          <h1 className="welcome-wordmark">
            Welcome to <span>GeoArchive</span>
          </h1>
          <p className="welcome-tagline">Your places. Told first-hand.</p>
          <p className="welcome-copy">
            GeoArchive is a map of places, told by the people who&apos;ve actually been there.
            Someone drops a pin, adds a photo, and leaves a note about what it was really
            like. You get the real story, not the polished version.
          </p>
          <p className="welcome-copy">
            Browse the map, tap a pin to see the photo and notes, or add a place of your
            own. Click anywhere on the map and you can drop a temporary pin to check its
            coordinates.
          </p>
          <div className="welcome-actions">
            <Link className="primary-button" href="/explore">
              Start exploring <ArrowRight size={15} />
            </Link>
            <Link className="pill-button" href="/login?mode=signup">
              Add a place <MapPin size={15} />
            </Link>
          </div>
        </div>
        <div className="welcome-sticker" aria-hidden="true">
          <MapPin size={54} strokeWidth={2.4} />
        </div>
      </section>

      <section className="welcome-stories" aria-label="Example stories">
        <div className="welcome-stories-heading">
          <p className="eyebrow welcome-eyebrow">
            <span className="eyebrow-spark">
              <Camera size={13} />
            </span>{" "}
            EXAMPLE STORIES
          </p>
          <p className="welcome-stories-note">
            Three examples — yours joins them after your{" "}
            <Link href="/login?mode=signup">first place</Link>.
          </p>
        </div>
        <ul className="welcome-grid">
          {EXAMPLES.map((example) => (
            <li
              className="welcome-slot"
              key={example.id}
              style={
                {
                  "--welcome-tilt": example.tilt,
                  "--welcome-delay": example.delay,
                  "--welcome-float-delay": example.floatDelay,
                } as CSSProperties
              }
            >
              <figure className="welcome-polaroid">
                <div className="welcome-polaroid-inner">
                  <span className={`welcome-tape welcome-tape-${example.id}`} aria-hidden="true" />
                  <div className="welcome-polaroid-photo">
                    <Image
                      src={example.src}
                      alt={example.alt}
                      width={480}
                      height={480}
                      placeholder="blur"
                      sizes="(max-width: 760px) 88vw, (max-width: 1100px) 30vw, 340px"
                    />
                  </div>
                  <div className="welcome-caption">
                    <strong>{example.place}</strong>
                    <span>{example.note}</span>
                  </div>
                </div>
              </figure>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
