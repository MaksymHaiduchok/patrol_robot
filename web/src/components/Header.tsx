"use client";

import { ChevronDown, LoaderCircle, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

function OperatorMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 items-center gap-2 rounded-full border bg-surface-2 pl-1 pr-2 text-body font-medium ${
          open ? "border-accent" : "border-border"
        }`}
      >
        <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-accent/20 text-caption font-bold text-accent-text">
          {OPERATOR_STUB.initials}
        </span>
        {OPERATOR_STUB.shortName}
        <ChevronDown aria-hidden className="size-3.5 text-text-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-20 w-[220px] rounded-lg border border-border-strong bg-surface-2 p-1.5 shadow-pop"
        >
          <div className="flex flex-col gap-0.5 border-b border-border px-2.5 pb-2.5 pt-2">
            <span className="text-body font-semibold">{OPERATOR_STUB.name}</span>
            <span className="text-caption text-text-muted">{OPERATOR_STUB.role}</span>
          </div>
          <Link
            href="/login"
            role="menuitem"
            className="mt-1 flex h-9 w-full items-center gap-2.5 rounded-sm bg-surface-3 px-2.5 text-body font-medium hover:bg-border"
          >
            <LogOut aria-hidden className="size-4" />
            Вийти
          </Link>
        </div>
      )}
    </div>
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
          <OperatorMenu />
        </div>
      </header>
    </div>
  );
}
