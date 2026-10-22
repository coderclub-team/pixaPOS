import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";
import { cn } from "../lib/utils";

interface FormSkeletonProps extends React.ComponentProps<"div"> {
  fieldCount?: number;
}

/**
 * Card-shaped placeholder mirroring the Card + FieldGroup layout used by
 * all new/edit forms. Render while the form's query is pending.
 */
function FormSkeleton({ fieldCount = 5, className, ...props }: FormSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading form"
      className={cn("mx-auto flex w-full max-w-xl flex-col", className)}
      {...props}
    >
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex flex-col items-center gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {Array.from({ length: fieldCount }).map((_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export { FormSkeleton };
