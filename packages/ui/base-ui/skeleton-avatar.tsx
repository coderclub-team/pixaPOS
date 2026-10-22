import { Skeleton } from "./skeleton";
import { cn } from "../lib/utils";

interface SkeletonAvatarProps extends React.ComponentProps<"div"> {
  size?: "xs" | "sm" | "md" | "lg";
}

/**
 * Circular avatar placeholder with fixed dimensions (no layout shift).
 */
const SIZES = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
} as const;

function SkeletonAvatar({ size = "md", className, ...props }: SkeletonAvatarProps) {
  return (
    <Skeleton
      aria-hidden
      className={cn("shrink-0 rounded-full", SIZES[size], className)}
      {...props}
    />
  );
}

export { SkeletonAvatar };
