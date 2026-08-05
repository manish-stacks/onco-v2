import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-sm)] bg-gradient-to-r from-black/[0.05] via-black/[0.08] to-black/[0.05] bg-[length:200%_100%]",
        className
      )}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4">
      <Skeleton className="mb-4 aspect-square w-full" />
      <Skeleton className="mb-2 h-3 w-1/2" />
      <Skeleton className="mb-3 h-4 w-4/5" />
      <Skeleton className="h-9 w-full rounded-full" />
    </div>
  );
}
