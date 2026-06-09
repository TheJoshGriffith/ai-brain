import { redirect } from "next/navigation";
import { canWrite } from "@ai-brain/core";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getSpacesAndCurrent } from "@/lib/current-space";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { spaces, current } = await getSpacesAndCurrent(session.user.id);

  return (
    <AppShell
      email={session.user.email ?? ""}
      spaces={spaces.map((s) => ({ id: s.id, name: s.name, role: s.role, isPersonal: s.isPersonal }))}
      current={{ id: current.id, name: current.name, role: current.role }}
      canWrite={canWrite(current.role)}
    >
      {children}
    </AppShell>
  );
}
