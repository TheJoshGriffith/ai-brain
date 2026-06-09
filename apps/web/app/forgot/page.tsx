import Link from "next/link";
import { Button, Card, FieldError, Input, Label } from "@/components/ui";
import { authService } from "@/lib/services";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  async function requestReset(formData: FormData) {
    "use server";
    await authService().requestPasswordReset(String(formData.get("email") ?? ""));
    const { redirect } = await import("next/navigation");
    redirect("/forgot?sent=1");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 hint">We’ll email you a link to set a new password.</p>
      <Card>
        {sent ? (
          <p className="text-sm">If an account exists for that email, a reset link is on its way.</p>
        ) : (
          <form action={requestReset} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <FieldError />
            <Button type="submit" className="w-full">Send reset link</Button>
          </form>
        )}
        <p className="mt-4 text-center hint">
          <Link href="/login" className="font-medium link-accent">Back to sign in</Link>
        </p>
      </Card>
    </main>
  );
}
