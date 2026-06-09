import "server-only";
import { getDb } from "@ai-brain/db";
import {
  AccessService,
  AdminService,
  AuthService,
  CommentService,
  DocumentService,
  LinkService,
  PortabilityService,
  SearchService,
  SharingService,
  SpaceService,
  TagService,
  TokenService,
} from "@ai-brain/core";

/** Service factories bound to the singleton DB client. */
export const authService = () => new AuthService(getDb());
export const adminService = () => new AdminService(getDb());
export const tokenService = () => new TokenService(getDb());
export const documentService = () => new DocumentService(getDb());
export const linkService = () => new LinkService(getDb());
export const searchService = () => new SearchService(getDb());
export const spaceService = () => new SpaceService(getDb());
export const accessService = () => new AccessService(getDb());
export const tagService = () => new TagService(getDb());
export const sharingService = () => new SharingService(getDb());
export const commentService = () => new CommentService(getDb());
export const portabilityService = () => new PortabilityService(getDb());
