import Link from "next/link";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Icons } from "@pixa/ui/icons";

const WALLBOARD_ICONS = {
  orders: Icons.orders,
  kitchen: Icons.kitchen,
} as const;

const WALLBOARDS = [
  {
    title: "Order Terminal",
    description: "Counter wallboard — seat tables, fire KOTs, settle bills.",
    href: "/kot",
    icon: "orders" as const,
  },
  {
    title: "Kitchen Display",
    description: "KDS wallboard — accept, prepare, mark ready, serve.",
    href: "/kds",
    icon: "kitchen" as const,
  },
];

export default function DashboardPage() {
  return (
    <PageContainer pageTitle="Dashboard" pageDescription="Welcome to pixaPOS">
      <div className="flex flex-1 items-center justify-center py-6">
        <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
          {WALLBOARDS.map((w) => {
            const WallboardIcon = WALLBOARD_ICONS[w.icon];
            return (
              <Card key={w.href} className="flex flex-col items-center p-8 text-center">
                <CardHeader className="items-center p-0">
                  <WallboardIcon className="size-10 text-primary" />
                  <CardTitle className="mt-3 text-xl">{w.title}</CardTitle>
                  <CardDescription>{w.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-6 p-0">
                  <Button nativeButton={false} render={<Link href={w.href} target="_blank" />}>
                    Open {w.title} <Icons.externalLink className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
