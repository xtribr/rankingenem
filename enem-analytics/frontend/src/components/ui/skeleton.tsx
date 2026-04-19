import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200/70",
        className
      )}
      {...props}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <Skeleton className="h-8 w-24 mb-2" />
      <Skeleton className="h-4 w-32 mb-1" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-4 h-1.5 w-full" />
    </div>
  );
}

export function AreaCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-4 w-16 mb-1" />
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className={cn("h-4", i === 1 ? "w-56" : "w-16")} />
        </td>
      ))}
    </tr>
  );
}
