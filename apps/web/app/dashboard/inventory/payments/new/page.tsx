import PageContainer from "@/components/layout/page-container";
import PaymentForm from "@/features/inventory/components/payment-form";
import { Suspense } from "react";

export const metadata = { title: "Dashboard : New Payment" };

export default async function Page() {
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <Suspense
          fallback={<div className="py-12 text-center text-muted-foreground">Loading…</div>}
        >
          <PaymentForm />
        </Suspense>
      </div>
    </PageContainer>
  );
}
