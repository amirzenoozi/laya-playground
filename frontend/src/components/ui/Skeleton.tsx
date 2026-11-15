export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-md bg-sunken motion-safe:animate-pulse ${className}`} />;
}
