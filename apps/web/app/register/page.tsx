import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card } from "@/components/ui";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  if (await auth()) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold">Create your account</h1>
      <p className="mb-6 hint">Start building your AI Brain.</p>
      <Card>
        <RegisterForm />
      </Card>
    </main>
  );
}
