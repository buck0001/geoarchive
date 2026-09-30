import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, signUp } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import ThemeToggle from "@/components/theme-toggle";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ mode, message }, supabase, config] = await Promise.all([
    searchParams,
    createClient(),
    Promise.resolve(getSupabaseConfig()),
  ]);
  const isSignUp = mode === "signup";

  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/");
  }

  return (
    <main className="auth-page">
      <div className="auth-marquee">YOUR WORLD, IN YOUR WORDS <span>✳</span> EVERY PLACE HAS A STORY <span>✳</span></div>
      <header className="auth-header">
        <Link className="brand" href="/">
          <span className="brand-mark">⌖</span>
          <span className="brand-word">geoarchive<span>.</span></span>
          <span className="brand-beta">FIELD NOTES</span>
        </Link>
        <ThemeToggle />
      </header>
      <section className="auth-card">
        <span className="auth-sticker">{isSignUp ? "✳" : "⌖"}</span>
        <p className="eyebrow">{isSignUp ? "START YOUR FIELD JOURNAL" : "WELCOME BACK, EXPLORER"}</p>
        <h1>{isSignUp ? "Make room for\nmore memories." : "Your places,\nright where you left them."}</h1>
        <p className="auth-copy">
          {isSignUp
            ? "Create a private archive for the places you want to remember."
            : "Sign in to pick up your personal place archive."}
        </p>

        {!config && (
          <div className="auth-message auth-setup-message">
            <strong>Connect your Supabase project to continue.</strong>
            <span>Add the project URL and publishable/anon key to <code>.env.local</code>, then apply the SQL migration in <code>supabase/migrations</code>.</span>
          </div>
        )}
        {message && <p className="auth-message" role="status">{message}</p>}

        <form className="auth-form" action={isSignUp ? signUp : signIn}>
          {isSignUp && (
            <label className="field-label">YOUR NAME
              <input className="text-input" type="text" name="displayName" autoComplete="name" maxLength={80} placeholder="Alex Morgan" />
            </label>
          )}
          <label className="field-label">EMAIL ADDRESS
            <input className="text-input" type="email" name="email" autoComplete="email" required placeholder="you@example.com" />
          </label>
          <label className="field-label">PASSWORD
            <input className="text-input" type="password" name="password" autoComplete={isSignUp ? "new-password" : "current-password"} minLength={8} required placeholder="At least 8 characters" />
          </label>
          {!isSignUp && <Link className="auth-forgot" href="/forgot-password">Forgot password?</Link>}
          <button className="primary-button auth-submit" type="submit">
            {isSignUp ? "Create my account" : "Sign in to GeoArchive"} <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="auth-switch">
          {isSignUp ? "Already have an account?" : "New to GeoArchive?"}{" "}
          <Link href={isSignUp ? "/login" : "/login?mode=signup"}>{isSignUp ? "Sign in" : "Create an account"}</Link>
        </p>
        <p className="auth-privacy">Your archive is private. Location is optional, always.</p>
        <p className="auth-switch"><Link href="/explore">Browse public places →</Link></p>
      </section>
      <footer className="auth-footer">GEOARCHIVE <span>✳</span> A LITTLE ARCHIVE FOR EVERYWHERE</footer>
    </main>
  );
}
