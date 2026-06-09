"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { SpaceRole } from "@ai-brain/core";
import { switchSpaceAction } from "@/app/(app)/spaces/actions";

interface SpaceOption {
  id: string;
  name: string;
  role: SpaceRole;
  isPersonal: boolean;
}

export function SpaceSwitcher({ spaces, currentId }: { spaces: SpaceOption[]; currentId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentId}
        disabled={pending}
        onChange={(e) => {
          if (e.target.value === "__new__") {
            router.push("/spaces");
            return;
          }
          startTransition(() => switchSpaceAction(e.target.value));
        }}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        aria-label="Current space"
      >
        {spaces.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.role !== "owner" ? ` · ${s.role}` : ""}
          </option>
        ))}
        <option value="__new__">+ New space…</option>
      </select>
    </div>
  );
}
