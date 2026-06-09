"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brain, Layers, Search, Settings, Users, History, Plus } from "lucide-react";
import type { SpaceRole } from "@ai-brain/core";
import { SpaceSwitcher } from "@/components/space-switcher";
import { CommandPalette } from "@/components/command-palette";
import { createDocumentAction } from "@/app/(app)/documents/actions";

interface SpaceOption { id: string; name: string; role: SpaceRole; isPersonal: boolean }

const SECTION: Record<string, string> = {
  documents: "Knowledge base",
  spaces: "Access control",
  settings: "Settings",
  search: "Search",
};

export function AppShell({
  email,
  spaces,
  current,
  canWrite,
  children,
}: {
  email: string;
  spaces: SpaceOption[];
  current: { id: string; name: string; role: SpaceRole };
  canWrite: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const section = pathname.startsWith("/spaces")
    ? "spaces"
    : pathname.startsWith("/settings")
      ? "settings"
      : pathname.startsWith("/search")
        ? "search"
        : "documents";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const railItem = (active: boolean, href: string, label: string, Icon: typeof Layers) => (
    <Link href={href} className="nav-item" data-active={active} title={label} aria-label={label}>
      <Icon />
    </Link>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Brain /></span>
        </div>
        <nav className="nav">
          {railItem(section === "documents", "/documents", "Knowledge base", Layers)}
          <button className="nav-item" data-active={section === "search"} title="Search (⌘K)" onClick={() => setPaletteOpen(true)}>
            <Search />
          </button>
          {railItem(section === "spaces", "/spaces", "Access control", Users)}
          {railItem(section === "settings", "/settings/tokens", "Settings", Settings)}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumbs">
            <SpaceSwitcher spaces={spaces} currentId={current.id} />
            <span className="sep">/</span>
            <span className="crumb cur">{SECTION[section]}</span>
          </div>
          <div className="spacer" />
          <button className="searchbtn" onClick={() => setPaletteOpen(true)}>
            <Search />
            <span>Search…</span>
            <span className="kbd">⌘K</span>
          </button>
          <Link href="/search" className="icon-btn" title="Search page">
            <History />
          </Link>
          {canWrite ? (
            <form action={createDocumentAction}>
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus /> New
              </button>
            </form>
          ) : null}
        </header>

        <div className="content">{children}</div>
      </div>

      {paletteOpen ? <CommandPalette spaceId={current.id} onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}
