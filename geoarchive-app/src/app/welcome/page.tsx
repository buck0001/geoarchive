import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { Compass, MapPin, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import WelcomeHero from "@/components/welcome-hero";

const vintageBrush = localFont({
  src: "../../assets/fonts/VintageBrush.ttf",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-brush",
});

export const metadata: Metadata = {
  title: "Welcome to GeoArchive",
  description: "A scrapbook of places told by the people who've actually been there.",
};

const welcomeLiteScript = `try{var c=navigator.hardwareConcurrency||8,d=navigator.deviceMemory||8;if(c<=4||d<=4)document.documentElement.setAttribute("data-welcome-lite","")}catch(e){}`;

export default function WelcomePage() {
  return (
    <main className={`welcome-page app-shell ${vintageBrush.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: welcomeLiteScript }} />
      <div className="announcement-bar">
        <span>YOUR WORLD, IN YOUR WORDS</span>
        <span aria-hidden="true"><Sparkles size={13} /></span>
        <span>EVERY PLACE HAS A STORY</span>
        <span aria-hidden="true"><Sparkles size={13} /></span>
        <span>YOUR WORLD, IN YOUR WORDS</span>
      </div>

      <header className="topbar">
        <Link className="brand" href="/" aria-label="GeoArchive home">
          <span className="brand-mark"><MapPin size={18} strokeWidth={2.7} /></span>
          <span className="brand-word">geoarchive<span>.</span></span>
          <span className="brand-beta">FIELD NOTES</span>
        </Link>
        <div className="topbar-center">
          <span className="status-dot" />
          <span>YOUR WORLD, YOUR WAY</span>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <Link className="pill-button explore-nav-link" href="/explore"><Compass size={14} /><span>Explore</span></Link>
        </div>
      </header>

      <WelcomeHero />

      <footer className="welcome-footer">
        <span>© 2026 GEOARCHIVE</span>
        <span className="welcome-footer-links">
          <Link href="/welcome">Intro</Link>
          <Link href="/explore">Explore</Link>
          <a href="/credits.txt">Photo credits</a>
        </span>
      </footer>
    </main>
  );
}
