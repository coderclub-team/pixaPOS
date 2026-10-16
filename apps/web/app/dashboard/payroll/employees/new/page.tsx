import PageContainer from "@pixa/ui/layout/page-container";
import EmployeeForm from "@/features/payroll/components/employee-form";

export default function NewEmployeePage() {
  return (
    <PageContainer pageTitle="Add Employee" pageDescription="Payroll — New employee">
      <EmployeeForm />
    </PageContainer>
  );
}
