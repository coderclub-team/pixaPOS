import Link from "next/link";
import PageContainer from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Icons } from "@pixa/ui/icons";

const LINKS = [
  {
    href: "/dashboard/payroll/employees",
    title: "Employees",
    desc: "Hourly & salaried staff, bank details",
  },
  {
    href: "/dashboard/payroll/leaves",
    title: "Leave Requests",
    desc: "Approve leave, track balances",
  },
  {
    href: "/dashboard/payroll/holidays",
    title: "Holidays",
    desc: "Public holidays & overtime rules",
  },
  {
    href: "/dashboard/payroll/runs",
    title: "Payroll Runs",
    desc: "Monthly runs, bonuses, bank CSV",
  },
  { href: "/dashboard/payroll/me", title: "My Payroll", desc: "Self-service: balances & payslips" },
];

export default function PayrollPage() {
  return (
    <PageContainer
      pageTitle="Payroll"
      pageDescription="Staff pay, leave, incentives and payslips for this outlet."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="transition hover:border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icons.chevronRight className="h-4 w-4" />
                  {l.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{l.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
