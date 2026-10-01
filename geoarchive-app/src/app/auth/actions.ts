"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeReturnTo } from "@/lib/safe-return-to";
import { isValidUsername, normalizeUsername, USERNAME_AUTH_DOMAIN, usernameAuthEmail } from "@/lib/auth-identity";

function authRedirect(message: string, returnTo = "/", mode?: "signup"): never {
  const safePath = safeReturnTo(returnTo);
  const params = new URLSearchParams({ next: safePath, message });
  if (mode) params.set("mode", mode);
  redirect(`/login?${params.toString()}`);
}

export async function signIn(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnToValue = formData.get("returnTo");
  const returnTo = safeReturnTo(typeof returnToValue === "string" ? returnToValue : null);
  if (!identifier || !password) authRedirect("Enter your username and password.", returnTo);

  const supabase = await createClient();
  if (!supabase) authRedirect("Add your Supabase URL and anon key to .env.local first.", returnTo);

  let email = identifier;
  const internalAuthDomain = `@${USERNAME_AUTH_DOMAIN}`;
  if (!identifier.includes("@") || identifier.toLowerCase().endsWith(internalAuthDomain)) {
    const username = normalizeUsername(identifier);
    const isInternalAlias = identifier.toLowerCase().endsWith(internalAuthDomain);
    const requestedUsername = isInternalAlias ? identifier.slice(2, -internalAuthDomain.length) : username;
    if (isInternalAlias && !identifier.toLowerCase().startsWith("u_")) {
      authRedirect("Username or password is incorrect.", returnTo);
    }
    if (!isValidUsername(requestedUsername)) authRedirect("Username or password is incorrect.", returnTo);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", requestedUsername)
      .maybeSingle();
    if (profileError) authRedirect("Could not check your username. Please try again.", returnTo);
    if (!profile) authRedirect("Username or password is incorrect.", returnTo);

    const admin = createAdminClient();
    if (!admin) authRedirect("Username sign-in needs the server-side Supabase service-role key configured.", returnTo);
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || !userResult.user?.email) authRedirect("Username or password is incorrect.", returnTo);
    email = userResult.user.email;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authRedirect("Username or password is incorrect.", returnTo);
  redirect(returnTo);
}

export async function signUp(formData: FormData) {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));
  if (!isValidUsername(username)) {
    authRedirect("Username must be 3–32 characters using letters, numbers, or underscores.", returnTo, "signup");
  }
  if (password.length < 8) authRedirect("Choose a password with at least 8 characters.", returnTo, "signup");
  if (password !== confirmation) authRedirect("The passwords do not match.", returnTo, "signup");
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)) {
    authRedirect("Enter a valid email address or leave it blank.", returnTo, "signup");
  }

  const supabase = await createClient();
  if (!supabase) authRedirect("Add your Supabase URL and anon key to .env.local first.", returnTo, "signup");
  const admin = createAdminClient();
  if (!admin) {
    authRedirect("Username registration needs the server-only SUPABASE_SERVICE_ROLE_KEY in .env.local.", returnTo, "signup");
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: usernameAuthEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error || !data.user) {
    authRedirect("That username is already taken or could not be registered. Try another username.", returnTo, "signup");
  }
  const userId = data.user.id;

  if (email) {
    const { error: contactError } = await admin.from("account_contacts").insert({ user_id: userId, email });
    if (contactError) {
      await admin.auth.admin.deleteUser(userId);
      authRedirect(`Your account could not save the optional email: ${contactError.message}`, returnTo, "signup");
    }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: usernameAuthEmail(username),
    password,
  });
  if (signInError) {
    await admin.auth.admin.deleteUser(userId);
    authRedirect(`Your account was created, but sign-in failed: ${signInError.message}`, returnTo, "signup");
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
