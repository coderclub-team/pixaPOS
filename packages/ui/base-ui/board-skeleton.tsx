import { Skeleton } from "./skeleton";
import { cn } from "../lib/utils";

interface BoardSkeletonProps extends React.ComponentProps<"div"> {
  blockCount?: number;
}

/**
 * Generic operations-board placeholder (KDS / terminal / dispatch / rider
 * shells): header row plus content blocks. Render in Suspense fallbacks and
 * while board queries are pending.
 */
function BoardSkeleton({ blockCount = 3, className, ...props }: BoardSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading board"
      className={cn("flex flex-1 flex-col gap-4 p-4 md:px-6", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      {Array.from({ length: blockCount }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-lg" />
      ))}
    </div>
  );
}

export { BoardSkeleton };
