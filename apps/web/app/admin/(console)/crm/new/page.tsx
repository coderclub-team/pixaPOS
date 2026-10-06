import Link from "next/link";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import PageContainer from "@/components/layout/page-container";
import { NewEnquiryForm } from "./form";

export default function NewEnquiryPage() {
  return (
    <PageContainer
      pageTitle="Log enquiry"
      pageDescription="Capture a customer enquiry before it becomes an organisation."
    >
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/admin/crm" />}
          className="px-0"
        >
          <Icons.chevronLeft className="size-3.5" aria-hidden />
          All enquiries
        </Button>
      </div>
      <NewEnquiryForm />
    </PageContainer>
  );
}
