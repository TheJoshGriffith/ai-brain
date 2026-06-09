import { handlers } from "@/auth";

// Credentials authorize() touches Postgres + argon2 — force the Node runtime.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
