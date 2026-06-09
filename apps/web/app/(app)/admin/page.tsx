import { notFound } from "next/navigation";
import type { RegistrationMode } from "@ai-brain/core";
import { auth } from "@/auth";
import { adminService, authService } from "@/lib/services";
import { Card } from "@/components/ui";
import { setRegistrationModeAction } from "./actions";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

const MODES: { value: RegistrationMode; label: string; desc: string }[] = [
  { value: "open", label: "Open", desc: "Anyone can sign up" },
  { value: "invite", label: "Invite-only", desc: "Requires an emailed invite" },
  { value: "closed", label: "Closed", desc: "No new sign-ups" },
];

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();

  const [mode, users] = await Promise.all([
    authService().getRegistrationMode(),
    adminService().listUsers(session.user.id),
  ]);

  return (
    <div className="wrap fade-in" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-sub">Instance settings, invitations, and users.</p>
        </div>
      </div>

      <div className="panel-card">
        <div className="ph"><div><h3>Registration</h3><p>Control who can create accounts.</p></div></div>
        <div className="pb">
          <div className="cfg-row">
            <div className="lbl"><div className="t">Mode</div><div className="d">Current: {mode}</div></div>
            <div className="ctl" style={{ gap: 12 }}>
              {MODES.map((m) => (
                <form key={m.value} action={setRegistrationModeAction}>
                  <input type="hidden" name="mode" value={m.value} />
                  <button type="submit" className="role-pill" data-on={mode === m.value} style={mode === m.value ? { color: "var(--accent)", borderColor: "var(--accent-line)", background: "var(--accent-soft)" } : undefined} title={m.desc}>
                    {m.label}
                  </button>
                </form>
              ))}
            </div>
          </div>
          <div className="cfg-row">
            <div className="lbl"><div className="t">Invite a user</div><div className="d">Sends a registration link</div></div>
            <div className="ctl"><InviteForm /></div>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <div className="ph"><div><h3>Users ({users.length})</h3></div></div>
        <div className="pb">
          {users.map((u) => (
            <div key={u.id} className="tool-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono-name" style={{ fontFamily: "var(--font-sans)" }}>{u.name ?? u.email}</div>
                <div className="desc">{u.email} · joined {new Date(u.createdAt).toLocaleDateString()}</div>
              </div>
              {u.isAdmin ? <span className="badge accent">admin</span> : null}
              {!u.emailVerified ? <span className="badge">unverified</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
