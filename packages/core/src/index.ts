export { config, type EmbeddingProviderName } from "./config";

// Auth primitives
export { hashPassword, verifyPassword } from "./auth/password";
export {
  generateToken,
  hashToken,
  safeHashEquals,
  TOKEN_PREFIX,
  TOKEN_SCOPES,
  type TokenScope,
  type GeneratedToken,
} from "./auth/token";

// Services
export {
  AuthService,
  AuthError,
  registerSchema,
  type RegisterInput,
} from "./services/auth.service";
export {
  TokenService,
  parseBearer,
  createTokenSchema,
  type CreateTokenInput,
  type Principal,
  type TokenSummary,
} from "./services/token.service";

// Document / link / search services are added in later phases.
