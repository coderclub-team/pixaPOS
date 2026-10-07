import PageContainer from "@/components/layout/page-container";
import { OverviewDashboard } from "@/features/overview/components/overview-dashboard";

export const metadata = { title: "Dashboard : Overview" };

export default function OverviewPage() {
  return (
    <PageContainer>
      <OverviewDashboard />
    </PageContainer>
  );
}
