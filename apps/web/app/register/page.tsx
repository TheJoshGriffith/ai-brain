import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authService } from "@/lib/services";
import { Card } from "@/components/ui";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; email?: string }>;
}) {
  if (await auth()) redirect("/dashboard");
  const { invite, email } = await searchParams;
  const mode = await authService().getRegistrationMode();

  if (mode === "closed" && !invite) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <Card>
          <h1 className="text-lg font-semibold">Registration is closed</h1>
          <p className="hint mt-1">This instance isn’t accepting new sign-ups. Ask an admin for an invite.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold">Create your account</h1>
      <p className="mb-6 hint">{invite ? "You’ve been invited to AI Brain." : "Start building your AI Brain."}</p>
      <Card>
        <RegisterForm inviteToken={invite} defaultEmail={email} />
      </Card>
    </main>
  );
}
