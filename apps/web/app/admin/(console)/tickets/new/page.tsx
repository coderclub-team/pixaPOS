import Link from "next/link";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import PageContainer from "@/components/layout/page-container";
import { NewTicketForm } from "./form";

export default function NewTicketPage() {
  return (
    <PageContainer
      pageTitle="Open ticket"
      pageDescription="Open a complaint ticket for triage and assignment."
    >
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/admin/tickets" />}
          className="px-0"
        >
          <Icons.chevronLeft className="size-3.5" aria-hidden />
          All tickets
        </Button>
      </div>
      <NewTicketForm />
    </PageContainer>
  );
}
