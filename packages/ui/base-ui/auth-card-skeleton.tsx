import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";
import { cn } from "../lib/utils";

/**
 * Centered auth-card placeholder for sign-in / sign-up / verify-phone /
 * onboarding while the session or org list is still loading.
 */
function AuthCardSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("flex min-h-svh items-center justify-center p-6 md:p-10", className)}
      {...props}
    >
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto flex flex-col items-center gap-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-64" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export { AuthCardSkeleton };
