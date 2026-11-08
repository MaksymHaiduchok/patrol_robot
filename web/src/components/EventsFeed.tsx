const LEGEND = [
  { label: "Людина в кадрі", className: "bg-ok" },
  { label: "Свій", className: "bg-accent" },
  { label: "Чужий", className: "bg-live" },
];

export function EventsFeed() {
  return (
    <aside className="flex min-h-80 flex-col border-border bg-surface lg:w-80 lg:shrink-0 lg:border-l">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Алерти</h2>
        <span className="rounded bg-surface-raised px-2 py-0.5 text-xs text-muted">0</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <span className="text-muted">Подій поки немає</span>
        <span className="text-xs text-muted">
          Тут з&apos;являтимуться люди в кадрі, свої й чужі з описом сцени
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-3">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`size-2 rounded-full ${item.className}`} />
            {item.label}
          </span>
        ))}
      </div>
    </aside>
  );
}
