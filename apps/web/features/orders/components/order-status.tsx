import { cn } from "@pixa/ui/lib/utils";
import type { OrderStatus } from "@/features/orders/api/types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  DRAFT: "text-muted-foreground",
  CONFIRMED: "text-sky-600",
  IN_KITCHEN: "text-amber-600",
  PREPARING: "animate-pulse text-orange-600",
  READY: "text-green-600",
  SERVED: "text-teal-600",
  COMPLETED: "text-emerald-700",
  CANCELLED: "text-red-600",
};

export default function OrderStatusText({
  status,
  progress,
}: {
  status: OrderStatus;
  /**
   * Kitchen progress readout ({ done, total } live item counts) — appended
   * as "· d/t" so the pill reads like the board ("Preparing · 3/5").
   * Hidden for carts (total 0) and terminal history. Omitted by default,
   * so existing callers render exactly as before.
   */
  progress?: { done: number; total: number } | null;
}) {
  // DRAFT is an internal pre-fire cart, never a shown state — every surface
  // agrees on the "New order" label (orders reach the list only after firing).
  const label = status === "DRAFT" ? "New order" : status.toLowerCase().replace("_", " ");
  const showProgress =
    progress && progress.total > 0 && status !== "COMPLETED" && status !== "CANCELLED";
  return (
    <span className={cn("text-xs font-medium capitalize", STATUS_STYLES[status])}>
      {label}
      {showProgress && (
        <span className="ml-1 font-normal normal-case text-muted-foreground">
          · {progress.done}/{progress.total}
        </span>
      )}
    </span>
  );
}
