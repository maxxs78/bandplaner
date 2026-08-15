import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <RegisterForm callbackUrl={callbackUrl ?? "/dashboard"} />
    </main>
  );
}
