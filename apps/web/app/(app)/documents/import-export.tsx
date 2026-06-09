"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";

export function ImportExportControls({ spaceId, mayWrite }: { spaceId: string; mayWrite: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      const res = await fetch(`/api/spaces/${spaceId}/import`, { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        alert(`Imported ${data.imported} document(s)${data.skipped ? `, skipped ${data.skipped}` : ""}.`);
        router.refresh();
      } else {
        alert(data.error ?? "Import failed");
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <a href={`/api/spaces/${spaceId}/export`} className="btn">
        <Download /> Export
      </a>
      {mayWrite ? (
        <>
          <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload /> {busy ? "Importing…" : "Import"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.zip"
            multiple
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
        </>
      ) : null}
    </>
  );
}
