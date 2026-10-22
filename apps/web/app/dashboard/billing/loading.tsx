import { SkeletonCard } from "@pixa/ui/base-ui/skeleton-card";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pt-2 pb-4 md:px-6 md:pt-4">
      <SkeletonCard textLines={3} footer />
      <SkeletonCard textLines={4} />
    </div>
  );
}
