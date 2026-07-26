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
}

export const fencePlugins: FencePlugin[] = [tibiaMapPlugin];

export function fencePluginFor(language: string | undefined): FencePlugin | undefined {
  if (!language) return undefined;
  return fencePlugins.find((p) => p.language === language);
}
