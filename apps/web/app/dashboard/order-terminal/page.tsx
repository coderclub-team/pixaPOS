import { Suspense } from "react";
import { BoardSkeleton } from "@pixa/ui/base-ui/board-skeleton";
import OrderTerminalPage from "@/features/table/components/order-terminal-view";

export const metadata = { title: "Dashboard : Order Terminal" };

export default function Page() {
  // NOTE: no server prefetch — table/order stores are localStorage-backed
  // mocks. Client fetches from the hydrated store. Same-origin tabs share the
  // Better Auth cookie session, so reception can keep this open in its own tab.
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <OrderTerminalPage />
    </Suspense>
  );
}
