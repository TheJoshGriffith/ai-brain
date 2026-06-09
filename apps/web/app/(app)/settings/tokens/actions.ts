"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { TokenScope, TokenSummary } from "@ai-brain/core";
import { auth } from "@/auth";
import { tokenService } from "@/lib/services";

export interface CreateTokenState {
  token?: string;
  summary?: TokenSummary;
  error?: string;
}

export async function createTokenAction(
  _prev: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const name = String(formData.get("name") ?? "").trim();
  const scopes = formData.getAll("scopes").map(String) as TokenScope[];
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();

  try {
    const { token, summary } = await tokenService().create(session.user.id, {
      name,
      scopes,
      expiresAt: expiresRaw ? new Date(expiresRaw) : undefined,
    });
    revalidatePath("/settings/tokens");
    return { token, summary };
  } catch (error) {
    if (error instanceof ZodError) {
      return { error: error.issues[0]?.message ?? "Invalid input" };
    }
    throw error;
  }
}

export async function revokeTokenAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const id = String(formData.get("id") ?? "");
  if (id) {
    await tokenService().revoke(session.user.id, id);
    revalidatePath("/settings/tokens");
  }
}
