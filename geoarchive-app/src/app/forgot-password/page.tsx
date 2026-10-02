import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import ThemeToggle from "@/components/theme-toggle";

type ForgotPasswordProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordProps) {
  const { message } = await searchParams;

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
        <p className="eyebrow">BACK TO YOUR PLACES</p>
        <h1>Let’s get you back in.</h1>
        <p className="auth-copy">Password reset is available for existing email-login accounts. Username-only accounts cannot currently recover a forgotten password. A private contact email is not used for password recovery.</p>
        {message && <p className="auth-message" role="status">{message}</p>}
        <form className="auth-form" action={requestPasswordReset}>
          <label className="field-label">EMAIL ADDRESS
            <input className="text-input" type="email" name="email" autoComplete="email" required placeholder="you@example.com" />
          </label>
          <button className="primary-button auth-submit" type="submit">Send reset link <ArrowRight size={14} aria-hidden="true" /></button>
        </form>
        <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
      </section>
      <footer className="auth-footer">GEOARCHIVE <span aria-hidden="true"><Sparkles size={12} /></span> A LITTLE ARCHIVE FOR EVERYWHERE</footer>
    </main>
  );
}
