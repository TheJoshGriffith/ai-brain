import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await auth()) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold">Sign in</h1>
      <p className="mb-6 hint">Welcome back to your AI Brain.</p>
      <Card>
        <LoginForm />
      </Card>
    </main>
  );
}
