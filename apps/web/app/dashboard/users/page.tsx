import PageContainer from "@/components/layout/page-container";
import UserListingPage from "@/features/users/components/user-listing";
import { searchParamsCache } from "@/lib/searchparams";
import type { SearchParams } from "nuqs/server";
import { UserFormSheetTrigger } from "@/features/users/components/user-form-sheet";

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
      pageHeaderAction={<UserFormSheetTrigger />}
    >
      <UserListingPage />
    </PageContainer>
  );
}
