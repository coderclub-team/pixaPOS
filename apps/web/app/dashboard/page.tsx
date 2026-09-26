"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { useIdentity } from "@/hooks/use-identity";

/**
 * Post-login landing: role-based wallboard routing, no picker cards.
 * Kitchen staff go straight to the KDS, counter roles to the order
 * terminal, everyone else to the overview dashboard.
 */
function targetForRole(role: string | null): string {
  const r = (role ?? "").replace(/^org:/, "");
  if (r === "kitchen") return "/kds";
  if (r === "waiter" || r === "cashier") return "/pos";
  return "/dashboard/overview";
}

export default function DashboardPage() {
  const router = useRouter();
  const { loaded, orgsLoaded, membership } = useIdentity();

  useEffect(() => {
    if (!loaded || !orgsLoaded) return;
    router.replace(targetForRole(membership.role));
  }, [loaded, orgsLoaded, membership.role, router]);

  return (
    <PageContainer pageTitle="Dashboard" pageDescription="Welcome to pixaPOS" isLoading>
      <div />
    </PageContainer>
  );
}
