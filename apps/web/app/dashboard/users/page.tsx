import PageContainer from "@/components/layout/page-container";
import UserListingPage from "@/features/users/components/user-listing";
import { searchParamsCache } from "@/lib/searchparams";
import type { SearchParams } from "nuqs/server";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import Link from "next/link";

export const metadata = {
  title: "Dashboard: Users",
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function UsersPage(props: PageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle="Users"
      pageDescription="Manage restaurant staff with POS roles (Owner, Manager, Cashier, Waiter, Kitchen, Accountant). Roles control floors/tables/orders access."
      pageHeaderAction={
        <Link href="/dashboard/users/new" className={cn(buttonVariants(), "text-xs md:text-sm")}>
          <Icons.add className="mr-2 h-4 w-4" /> Add New
        </Link>
      }
    >
      <UserListingPage />
    </PageContainer>
  );
}
