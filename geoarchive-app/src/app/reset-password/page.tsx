import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { updatePassword } from "@/app/auth/actions";
import ThemeToggle from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  return (
    <main className="auth-page">
      <div className="auth-marquee">YOUR WORLD, IN YOUR WORDS <span aria-hidden="true"><Sparkles size={13} /></span> EVERY PLACE HAS A STORY <span aria-hidden="true"><Sparkles size={13} /></span></div>
      <header className="auth-header">
        <Link className="brand" href="/">
          <span className="brand-mark"><MapPin size={18} strokeWidth={2.7} /></span>
          <span className="brand-word">geoarchive<span>.</span></span>
          <span className="brand-beta">FIELD NOTES</span>
        </Link>
        <ThemeToggle />
      </header>
      <section className="auth-card">
        <p className="eyebrow">SECURE YOUR FIELD JOURNAL</p>
        <h1>Choose a new password.</h1>
        {user ? (
          <>
            <p className="auth-copy">Use at least 8 characters, then sign in again with your new password.</p>
            <form className="auth-form" action={updatePassword}>
              <label className="field-label">NEW PASSWORD
                <input className="text-input" type="password" name="password" autoComplete="new-password" minLength={8} required />
              </label>
              <label className="field-label">CONFIRM PASSWORD
                <input className="text-input" type="password" name="confirmation" autoComplete="new-password" minLength={8} required />
              </label>
              <button className="primary-button auth-submit" type="submit">Update password <ArrowRight size={14} aria-hidden="true" /></button>
            </form>
          </>
        ) : (
          <>
            <p className="auth-copy">Open this page from the secure password-reset link in your email.</p>
            <Link className="primary-button auth-submit" href="/forgot-password">Request a new reset link <ArrowRight size={14} aria-hidden="true" /></Link>
          </>
        )}
      </section>
      <footer className="auth-footer">GEOARCHIVE <span aria-hidden="true"><Sparkles size={12} /></span> A LITTLE ARCHIVE FOR EVERYWHERE</footer>
    </main>
  );
}
