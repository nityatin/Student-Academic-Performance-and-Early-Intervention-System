"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function out() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={out}
      className="rounded border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      Sign out
    </button>
  );
}
