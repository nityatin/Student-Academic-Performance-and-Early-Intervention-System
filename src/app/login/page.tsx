import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSession()) redirect("/");
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mb-6 mt-1 text-sm text-slate2">Student Academic Performance &amp; Early Intervention System</p>
      <div className="rounded-lg border border-line bg-white p-6">
        <LoginForm next={next} />
      </div>
    </div>
  );
}
