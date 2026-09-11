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

export default function OrderStatusText({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("text-xs font-medium capitalize", STATUS_STYLES[status])}>
      {status.toLowerCase().replace("_", " ")}
    </span>
  );
}
