import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui";
import { signOutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="font-semibold">
              AI Brain
            </Link>
            <Link href="/documents" className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
              Documents
            </Link>
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
