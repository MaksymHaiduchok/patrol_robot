"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OPERATOR_STUB } from "@/lib/operator";

type HeaderProps = {
  live: boolean;
  apiDown?: boolean;
};

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Панель" },
  { href: "/events", label: "Журнал подій" },
  { href: "/persons", label: "Свої" },
];

function LiveBadge({ live }: { live: boolean }) {
  if (live) {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-xs bg-danger px-2 text-caption font-bold text-white">
        <span className="size-1.5 animate-live-pulse rounded-full bg-white" />
        LIVE
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-xs bg-border-strong px-2 text-caption font-bold text-text-muted">
      <span className="size-1.5 rounded-full bg-ev-left" />
      Offline
    </span>
  );
}

function OperatorBadge() {
  return (
    <span className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface-2 pl-1 pr-3 text-body font-medium">
      <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-accent/20 text-caption font-bold text-accent-text">
        {OPERATOR_STUB.initials}
      </span>
      {OPERATOR_STUB.shortName}
    </span>
  );
}

export function Header({ live, apiDown = false }: HeaderProps) {
  const pathname = usePathname();

  return (
    <div className="relative w-full">
      {apiDown && (
        <div
          role="status"
          className="flex min-h-[30px] items-center justify-center gap-2.5 bg-warn-surface px-4 py-1 text-small font-medium text-warn-text"
        >
          <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
          Немає з&apos;єднання з сервером. Перепідключення…
        </div>
      )}
      <header className="flex min-h-14 flex-wrap items-center gap-x-7 gap-y-2 border-b border-border bg-surface px-5 py-2">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="inline-flex size-[30px] items-center justify-center rounded-[7px] bg-accent text-[13px] font-bold text-accent-on">
            PR
          </span>
          <span className="text-heading font-semibold">Patrol Robot</span>
        </Link>
        <nav aria-label="Основна навігація" className="flex flex-wrap gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-9 items-center rounded-sm px-3 text-body ${
                  active
                    ? "bg-surface-3 font-semibold text-text"
                    : "font-medium text-text-muted hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3.5">
          <LiveBadge live={live} />
          <OperatorBadge />
        </div>
      </header>
    </div>
  );
}
