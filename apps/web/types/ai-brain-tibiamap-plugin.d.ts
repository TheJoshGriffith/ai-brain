declare module "ai-brain-tibiamap-plugin" {
  import type { ComponentType, ReactNode } from "react";
  const plugin: {
    language: string;
    Component: ComponentType<{ code: string }>;
    link?: {
      match: (href: string) => boolean;
      Component: ComponentType<{ href: string; children?: ReactNode }>;
    };
  };
  export default plugin;
}

declare module "ai-brain-tibiamap-plugin/react" {
  import type { ComponentType } from "react";
  export const TibiaMap: ComponentType<{
    center?: [number, number, number] | string;
    zoom?: number;
    height?: number | string;
    markers?: { x: number; y: number; z: number; label?: string }[];
    route?: { x: number; y: number; z: number }[];
    static?: boolean;
  }>;
}
