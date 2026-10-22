import { Skeleton } from "./skeleton";
import { SkeletonText } from "./skeleton-text";
import { Card, CardContent, CardFooter, CardHeader } from "./card";
import { cn } from "../lib/utils";

interface SkeletonCardProps extends React.ComponentProps<"div"> {
  /** Show a media/banner block on top (e.g. product or receipt cards). */
  media?: boolean;
  /** Show a footer action row. */
  footer?: boolean;
  textLines?: number;
}

/**
 * Generic card placeholder: optional media, title + text lines, optional
 * footer actions. Compose inside grids/lists to mirror real card layouts
 * 1:1 and hold their exact footprint.
 */
function SkeletonCard({
  media = false,
  footer = false,
  textLines = 2,
  className,
  ...props
}: SkeletonCardProps) {
  return (
    <Card aria-hidden className={className} {...props}>
      {media ? <Skeleton className="h-36 w-full rounded-none rounded-t-xl" /> : null}
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-1/2" />
      </CardHeader>
      <CardContent>
        <SkeletonText lines={textLines} />
      </CardContent>
      {footer ? (
        <CardFooter className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </CardFooter>
      ) : null}
    </Card>
  );
}

export { SkeletonCard, type SkeletonCardProps };
