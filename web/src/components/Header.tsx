type HeaderProps = {
  online: boolean;
};

export function Header({ online }: HeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded bg-accent text-sm font-bold">
          PR
        </span>
        <span className="font-semibold">Patrol Robot</span>
        <span className="hidden text-sm text-muted sm:inline">Панель оператора</span>
      </div>
      <span
        className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
          online ? "bg-live text-white" : "bg-surface-raised text-muted"
        }`}
      >
        {online ? "Live" : "Offline"}
      </span>
    </header>
  );
}
