"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { fetchEvents } from "@/lib/api";
import { EVENT_LABELS, eventTitle, formatDateTime, reviewLabel } from "@/lib/eventLabels";
import type { EventsPage, SystemMode } from "@/lib/protocol";
import { usePersons } from "@/lib/usePersons";
import { useVisionHealth } from "@/lib/useVisionHealth";

const PAGE_SIZE = 25;
const MODE_LABELS: Record<SystemMode, string> = { PATROL: "Патруль", STATIONARY: "Стаціонар" };

export function EventsLog() {
  const health = useVisionHealth();
  const { names } = usePersons();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<EventsPage | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEvents(PAGE_SIZE, page * PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex min-h-screen flex-col">
      <Header live={health?.source_connected ?? false} />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">Журнал подій</h1>
          {data && <span className="text-sm text-text-muted">Усього: {data.total}</span>}
        </div>

        {error && <p className="text-danger-text">Не вдалося завантажити події. Перевір, чи запущений api.</p>}

        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Час</th>
                <th className="px-4 py-3 font-semibold">Подія</th>
                <th className="px-4 py-3 font-semibold">Впевненість</th>
                <th className="px-4 py-3 font-semibold">Оцінка оператора</th>
                <th className="px-4 py-3 font-semibold">Режим</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((event) => (
                <tr key={event.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">{formatDateTime(event.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${EVENT_LABELS[event.type].dotClassName}`} />
                      {eventTitle(event, names)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {event.confidence !== null ? `${Math.round(event.confidence * 100)}%` : "—"}
                  </td>
                  <td className="px-4 py-3">{reviewLabel(event, names) ?? <span className="text-text-muted">—</span>}</td>
                  <td className="px-4 py-3 text-text-muted">{event.mode ? MODE_LABELS[event.mode] : "—"}</td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    Подій поки немає
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
            className="rounded bg-surface-2 px-3 py-1.5 hover:bg-border disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-text-muted">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded bg-surface-2 px-3 py-1.5 hover:bg-border disabled:opacity-40"
          >
            Далі
          </button>
        </div>
      </main>
    </div>
  );
}
