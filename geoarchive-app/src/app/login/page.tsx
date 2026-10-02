import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, signUp } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import ThemeToggle from "@/components/theme-toggle";
import { safeReturnTo } from "@/lib/safe-return-to";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string; message?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ mode, message, next }, supabase, config] = await Promise.all([
    searchParams,
    createClient(),
    Promise.resolve(getSupabaseConfig()),
  ]);
  const isSignUp = mode === "signup";
  const returnTo = safeReturnTo(next);

  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect(returnTo);
  }

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
        <span className="auth-sticker" aria-hidden="true">{isSignUp ? <Sparkles size={23} /> : <MapPin size={23} strokeWidth={2.7} />}</span>
        <p className="eyebrow">{isSignUp ? "START YOUR FIELD JOURNAL" : "WELCOME BACK, EXPLORER"}</p>
        <h1>{isSignUp ? "Make room for\nmore memories." : "Your places,\nright where you left them."}</h1>
        <p className="auth-copy">
          {isSignUp
            ? "Choose a username and password to create your private archive. Email is optional."
            : "Sign in to pick up your personal place archive."}
        </p>

        {!config && (
          <div className="auth-message auth-setup-message">
            <strong>Connect your Supabase project to continue.</strong>
            <span>Add the project URL, publishable/anon key and server-only service-role key to <code>.env.local</code>, then apply the SQL migrations in <code>supabase/migrations</code>.</span>
          </div>
        )}
        {message && <p className="auth-message" role="status">{message}</p>}

        <form className="auth-form" action={isSignUp ? signUp : signIn}>
          <input type="hidden" name="returnTo" value={returnTo} />
          {isSignUp ? (
            <>
              <label className="field-label">USERNAME
                <input className="text-input" type="text" name="username" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" required placeholder="e.g. buck" />
              </label>
              <label className="field-label">PASSWORD
                <input className="text-input" type="password" name="password" autoComplete="new-password" minLength={8} required placeholder="At least 8 characters" />
              </label>
              <label className="field-label">CONFIRM PASSWORD
                <input className="text-input" type="password" name="confirmation" autoComplete="new-password" minLength={8} required placeholder="Enter your password again" />
              </label>
              <label className="field-label">EMAIL <span>(OPTIONAL)</span>
                <input className="text-input" type="email" name="email" autoComplete="email" maxLength={320} placeholder="you@example.com" />
              </label>
              <p className="auth-privacy">Email is private contact information only. Without a recovery email, a forgotten password cannot currently be reset.</p>
            </>
          ) : (
            <>
              <label className="field-label">USERNAME
                <input className="text-input" type="text" name="identifier" autoComplete="username" required placeholder="Your username" />
                <span className="auth-field-hint">Existing accounts can still sign in with their email address.</span>
              </label>
              <label className="field-label">PASSWORD
                <input className="text-input" type="password" name="password" autoComplete="current-password" minLength={8} required placeholder="Your password" />
              </label>
            </>
          )}
          {!isSignUp && <Link className="auth-forgot" href="/forgot-password">Forgot password? (email accounts)</Link>}
          <button className="primary-button auth-submit" type="submit">
            {isSignUp ? "Create account" : "Log in"} <ArrowRight size={14} aria-hidden="true" />
          </button>
        </form>
        <p className="auth-switch">
          {isSignUp ? "Already have an account?" : "New to GeoArchive?"}{" "}
          <Link href={`${isSignUp ? "/login" : "/login?mode=signup"}${returnTo !== "/" ? `${isSignUp ? "?" : "&"}next=${encodeURIComponent(returnTo)}` : ""}`}>{isSignUp ? "Sign in" : "Create an account"}</Link>
        </p>
        <p className="auth-privacy">Your archive is private. Location is optional, always.</p>
        <p className="auth-switch"><Link href="/explore">Browse public places <ArrowRight size={12} aria-hidden="true" /></Link></p>
      </section>
      <footer className="auth-footer">GEOARCHIVE <span aria-hidden="true"><Sparkles size={12} /></span> A LITTLE ARCHIVE FOR EVERYWHERE</footer>
    </main>
  );
}
