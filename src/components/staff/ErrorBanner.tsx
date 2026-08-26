export function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="mb-4 rounded-lg border border-warning bg-warning-surface px-4 py-2.5 text-sm font-medium text-warning">{error}</div>
  );
}
