import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui";
import { SpaceSwitcher } from "@/components/space-switcher";
import { getSpacesAndCurrent } from "@/lib/current-space";
import { signOutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { spaces, current } = await getSpacesAndCurrent(session.user.id);

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/dashboard" className="font-semibold">
              AI Brain
            </Link>
            <SpaceSwitcher spaces={spaces} currentId={current.id} />
            <Link href="/documents" className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
              Documents
            </Link>
            <Link href="/search" className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
              Search
            </Link>
            {current.role === "owner" ? (
              <Link
                href={`/spaces/${current.id}/settings`}
                className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Members
              </Link>
            ) : null}
            <Link href="/settings/tokens" className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
              Tokens
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="hidden sm:inline">{session.user.email}</span>
            <form action={signOutAction}>
              <Button variant="ghost" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
