"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function accountRedirect(message: string): never {
  redirect(`/account?message=${encodeURIComponent(message)}`);
}

export async function saveAccountEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (email && (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    accountRedirect("Enter a valid email address or leave the field blank.");
  }

  const supabase = await createClient();
  if (!supabase) accountRedirect("Supabase is not configured.");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { error } = await supabase.from("account_contacts").upsert({
    user_id: user.id,
    email: email || null,
    updated_at: new Date().toISOString(),
  });
  if (error) accountRedirect(`Could not save your contact email: ${error.message}`);
  accountRedirect("Your private contact email was updated.");
}
