import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/saas-owner";
import { LoginForm } from "./form";

export const metadata = {
  title: "Owner sign-in — pixaPOS Admin",
};

/** Isolated owner login. Redirects straight in when an owner session exists. */
export default async function AdminLoginPage() {
  const owner = await getOwnerSession().catch(() => null);
  if (owner) redirect("/admin");
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-lg font-semibold tracking-tight">pixaPOS</p>
        <p className="text-xs text-zinc-500">SaaS owner sign-in</p>
        <LoginForm />
        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          Owner accounts only. Restaurant users sign in on the app — those credentials never work
          here.
        </p>
      </div>
    </div>
  );
}
