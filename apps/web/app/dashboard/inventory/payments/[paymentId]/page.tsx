import PageContainer from "@/components/layout/page-container";
import PaymentDetail from "@/features/inventory/components/payment-detail";

export const metadata = { title: "Dashboard : Payment" };
type PageProps = { params: Promise<{ paymentId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <PaymentDetail paymentId={params.paymentId} />
      </div>
    </PageContainer>
  );
}
