export function DotLoader({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
      style={{ animationDelay: `${delay}ms` }}
    ></div>
  );
}
