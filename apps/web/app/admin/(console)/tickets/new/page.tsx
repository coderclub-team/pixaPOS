import PageContainer from "@/components/layout/page-container";
import { NewTicketForm } from "./form";

export default function NewTicketPage() {
  return (
    <PageContainer
      pageTitle="Open ticket"
      pageDescription="Open a complaint ticket for triage and assignment."
    >
      <NewTicketForm />
    </PageContainer>
  );
}
