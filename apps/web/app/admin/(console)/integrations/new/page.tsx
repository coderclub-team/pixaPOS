import Link from "next/link";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import PageContainer from "@/components/layout/page-container";
import { NewProviderForm } from "./form";

export default function NewProviderPage() {
  return (
    <PageContainer
      pageTitle="Add provider"
      pageDescription="Connect WhatsApp, SMS, email, Meta or Google Ads. Credentials are set after creation."
    >
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/admin/integrations" />}
          className="px-0"
        >
          <Icons.chevronLeft className="size-3.5" aria-hidden />
          All integrations
        </Button>
      </div>
      <NewProviderForm />
    </PageContainer>
  );
}
