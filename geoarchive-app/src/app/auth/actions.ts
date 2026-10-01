"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/safe-return-to";

function authRedirect(message: string): never {
  redirect(`/login?message=${encodeURIComponent(message)}`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) authRedirect("Enter your email and password.");

  const supabase = await createClient();
  if (!supabase) authRedirect("Add your Supabase URL and anon key to .env.local first.");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authRedirect(error.message);
  const returnTo = formData.get("returnTo");
  redirect(safeReturnTo(typeof returnTo === "string" ? returnTo : null));
}

export async function signUp(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));
  if (!email || password.length < 8) {
    authRedirect("Use a valid email and a password with at least 8 characters.");
  }

  const supabase = await createClient();
  if (!supabase) authRedirect("Add your Supabase URL and anon key to .env.local first.");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=${encodeURIComponent(returnTo)}`,
    },
  });
  if (error) authRedirect(error.message);
  if (!data.session) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}&message=${encodeURIComponent("Check your email to confirm your account, then sign in.")}`);
  }
  redirect(returnTo);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) authRedirect("Enter the email address on your account.");

  const supabase = await createClient();
  if (!supabase) authRedirect("Add your Supabase URL and anon key to .env.local first.");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/reset-password`,
  });
  if (error) authRedirect(error.message);
  redirect(`/login?message=${encodeURIComponent("If that address is registered, a password reset link is on its way.")}`);
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) authRedirect("Choose a password with at least 8 characters.");
  if (password !== confirmation) authRedirect("The passwords do not match.");

  const supabase = await createClient();
  if (!supabase) authRedirect("Add your Supabase URL and anon key to .env.local first.");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) authRedirect("Open the password reset link from your email first.");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) authRedirect(error.message);
  redirect("/");
}
