"use server";

import { AuthError as NextAuthError } from "next-auth";
import { ZodError } from "zod";
import { AuthError as CoreAuthError } from "@ai-brain/core";
import { signIn } from "@/auth";
import { authService } from "@/lib/services";
import type { AuthFormState } from "@/app/login/actions";

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const inviteToken = String(formData.get("inviteToken") ?? "") || undefined;

  try {
    await authService().register({ email, password, name: name || undefined, inviteToken });
  } catch (error) {
    if (error instanceof ZodError) {
      return { error: error.issues[0]?.message ?? "Invalid input" };
    }
    if (error instanceof CoreAuthError) {
      return { error: error.message };
    }
    throw error;
  }

  // Account created — sign them straight in (throws a redirect on success).
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return {};
  } catch (error) {
    if (error instanceof NextAuthError) {
      return { error: "Account created, but automatic sign-in failed. Please sign in." };
    }
    throw error;
  }
}
