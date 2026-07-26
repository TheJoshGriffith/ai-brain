"use client";

import type { ComponentType } from "react";
import tibiaMapPlugin from "ai-brain-tibiamap-plugin";

/**
 * Markdown fence plugin registry.
 *
 * A fence plugin claims a fenced-code-block language (```lang) and renders the
 * block's body with a React component instead of a <pre>. In renderers without
 * the plugin the block degrades gracefully to a plain code block.
 */
export interface FencePlugin {
  /** Fence info string to claim, e.g. "tibiamap". */
  language: string;
  /** Receives the raw fence body. */
  Component: ComponentType<{ code: string }>;
  /** Optional link handler: claims matching hrefs anywhere in the document. */
  link?: {
    match: (href: string) => boolean;
    Component: ComponentType<{ href: string; children?: React.ReactNode }>;
  };
}

export const fencePlugins: FencePlugin[] = [tibiaMapPlugin];

export function fencePluginFor(language: string | undefined): FencePlugin | undefined {
  if (!language) return undefined;
  return fencePlugins.find((p) => p.language === language);
}

export function linkPluginFor(href: string | undefined): FencePlugin["link"] | undefined {
  if (!href) return undefined;
  return fencePlugins.find((p) => p.link?.match(href))?.link;
}
