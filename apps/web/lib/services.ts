import "server-only";
import { getDb } from "@ai-brain/db";
import { AuthService, DocumentService, TokenService } from "@ai-brain/core";

/** Service factories bound to the singleton DB client. */
export const authService = () => new AuthService(getDb());
export const tokenService = () => new TokenService(getDb());
export const documentService = () => new DocumentService(getDb());
