export default function CircleDetailsLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-10 w-64 rounded-md bg-muted" />
        <div className="h-4 w-full max-w-xl rounded bg-muted" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 rounded-xl bg-muted" />
        <div className="h-56 rounded-xl bg-muted" />
      </div>
      <div className="h-72 rounded-xl bg-muted" />
    </div>
  );
}
