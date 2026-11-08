"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type HeaderProps = {
  online: boolean;
};

const NAV_ITEMS = [
  { href: "/", label: "Панель" },
  { href: "/events", label: "Журнал подій" },
];

export function Header({ online }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded bg-accent text-sm font-bold">
            PR
          </span>
          <span className="font-semibold">Patrol Robot</span>
        </Link>
        <nav className="flex gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                pathname === item.href
                  ? "bg-surface-raised text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
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
