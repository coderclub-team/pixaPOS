import PageContainer from "@/components/layout/page-container";
import KdsBoard from "@/features/kitchen/components/kds-board";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import Link from "next/link";

export default function KitchenBoardPage() {
  return (
    <PageContainer
      pageTitle="Kitchen"
      pageDescription="Live kitchen tickets — accept, prepare, mark ready, serve."
      pageHeaderAction={
        <Button variant="outline" size="sm" render={<Link href="/kds" target="_blank" />}>
          <Icons.externalLink className="mr-1 size-4" /> Open wallboard
        </Button>
      }
    >
      <KdsBoard />
    </PageContainer>
  );
}
