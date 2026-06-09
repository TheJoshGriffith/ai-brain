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

export {
  DocumentService,
  DocumentNotFoundError,
  createDocumentSchema,
  updateDocumentSchema,
  type CreateDocumentInput,
  type UpdateDocumentInput,
  type DocumentSummary,
} from "./services/document.service";
export {
  parseMarkdown,
  slugify,
  deriveTitle,
  type ParsedMarkdown,
} from "./markdown/parse";

// Link / search services are added in later phases.
