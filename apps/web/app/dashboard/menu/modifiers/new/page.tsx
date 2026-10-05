import PageContainer from "@/components/layout/page-container";
import ModifierGroupForm from "@/features/menu/components/modifier-group-form";

export const metadata = { title: "Dashboard : New Add-on Group" };

export default function NewModifierGroupPage() {
  return (
    <PageContainer
      pageTitle="New Add-on Group"
      pageDescription="Name it, set min/max rules, then add options."
    >
      <ModifierGroupForm />
    </PageContainer>
  );
}
