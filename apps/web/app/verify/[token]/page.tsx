import Link from "next/link";
import { Card } from "@/components/ui";
import { authService } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await authService().verifyEmail(token);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <h1 className="text-lg font-semibold">{ok ? "Email verified" : "Verification failed"}</h1>
        <p className="hint mt-1">
          {ok ? "Thanks — your email address is confirmed." : "This verification link is invalid or has expired."}
        </p>
        <p className="mt-4">
          <Link href="/login" className="link-accent font-medium">Continue to sign in</Link>
        </p>
      </Card>
    </main>
  );
}
