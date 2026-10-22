import { Skeleton } from "./skeleton";
import { cn } from "../lib/utils";

interface SkeletonTextProps extends React.ComponentProps<"div"> {
  lines?: number;
  /** Tailwind width classes per line; last line defaults narrower like prose. */
  widths?: string[];
  lineClassName?: string;
}

/**
 * Stacked text-line placeholder. Widths default to full/full/2-3 so the
 * block reads like a paragraph and reserves matching vertical rhythm.
 */
function SkeletonText({
  lines = 3,
  widths,
  lineClassName,
  className,
  ...props
}: SkeletonTextProps) {
  const resolved = Array.from({ length: lines }, (_, i) => {
    if (widths?.[i]) return widths[i];
    return i === lines - 1 && lines > 1 ? "w-2/3" : "w-full";
  });
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden {...props}>
      {resolved.map((w, i) => (
        <Skeleton key={i} className={cn("h-4", w, lineClassName)} />
      ))}
    </div>
  );
}

export { SkeletonText };
