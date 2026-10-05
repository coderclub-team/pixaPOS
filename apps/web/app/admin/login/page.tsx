import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/saas-owner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { LoginForm } from "./form";

/** Isolated owner login. Redirects straight in when an owner session exists. */
export default async function AdminLoginPage() {
  const owner = await getOwnerSession().catch(() => null);
  if (owner) redirect("/admin");
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">pixaPOS</CardTitle>
          <CardDescription>SaaS owner sign-in</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Owner accounts only. Restaurant users sign in on the app — those credentials never work
            here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
