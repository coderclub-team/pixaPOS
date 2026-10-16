import PageContainer from "@pixa/ui/layout/page-container";
import { HolidayManager } from "@/features/payroll/components/holiday-manager";

export default function HolidaysPage() {
  return (
    <PageContainer
      pageTitle="Holidays"
      pageDescription="Public holidays and overtime rules for holiday work."
    >
      <HolidayManager />
    </PageContainer>
  );
}
