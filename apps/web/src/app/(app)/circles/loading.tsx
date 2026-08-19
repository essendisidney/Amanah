export default function CirclesLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-48 rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-xl bg-muted" />
        <div className="h-36 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
