import { redirect } from "next/navigation";
import { AuthError } from "@ai-brain/core";
import { Button, Card, FieldError, Input, Label } from "@/components/ui";
import { authService } from "@/lib/services";

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  async function reset(formData: FormData) {
    "use server";
    try {
      await authService().resetPassword(token, String(formData.get("password") ?? ""));
    } catch (e) {
      if (e instanceof AuthError) redirect(`/reset/${token}?error=${encodeURIComponent(e.message)}`);
      throw e;
    }
    redirect("/login?reset=1");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold">Choose a new password</h1>
      <p className="mb-6 hint">Enter a new password for your account.</p>
      <Card>
        <form action={reset} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full">Set new password</Button>
        </form>
      </Card>
    </main>
  );
}
