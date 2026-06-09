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
  DocumentForbiddenError,
  createDocumentSchema,
  updateDocumentSchema,
  type CreateDocumentInput,
  type UpdateDocumentInput,
  type DocumentSummary,
} from "./services/document.service";

// Spaces, membership & access control
export {
  ROLE_RANK,
  maxRole,
  canRead,
  canComment,
  canWrite,
  canManage,
} from "./auth/roles";
export type { SpaceRole } from "@ai-brain/db";
export {
  AccessService,
  type Access,
  type DocumentAccess,
} from "./services/access.service";
export {
  SpaceService,
  SpaceError,
  SpaceForbiddenError,
  createSpaceSchema,
  addMemberSchema,
  SPACE_ROLE_VALUES,
  type SpaceWithRole,
  type MemberView,
} from "./services/space.service";
export {
  parseMarkdown,
  slugify,
  deriveTitle,
  extractWikiLinks,
  type ParsedMarkdown,
  type WikiLink,
} from "./markdown/parse";
export {
  LinkService,
  type BacklinkRef,
  type OutboundLink,
} from "./services/link.service";
export { SearchService, type SearchResult } from "./services/search.service";
export { TagService, normalizeTag } from "./services/tag.service";
export {
  SharingService,
  SHARE_ROLES,
  type ShareSummary,
  type ShareGrant,
  type CreateLinkInput,
} from "./services/sharing.service";
export { CommentService, type CommentView } from "./services/comment.service";
export { PortabilityService, type ImportResult } from "./services/portability.service";
export { IndexingService } from "./services/indexing.service";
export { QueueService, type JobType } from "./services/queue.service";
export { chunkContent } from "./search/chunk";
export {
  getEmbeddingProvider,
  LocalEmbeddingProvider,
  VoyageEmbeddingProvider,
  OpenAIEmbeddingProvider,
  type EmbeddingProvider,
} from "./embeddings";
