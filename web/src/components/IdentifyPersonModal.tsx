"use client";

import { type FormEvent, useState } from "react";
import { createPerson, reviewEvent } from "@/lib/api";
import { VISION_STREAM_URL } from "@/lib/config";
import { formatTime } from "@/lib/eventLabels";
import type { EventRecord, PersonRecord, ReviewEventRequest } from "@/lib/protocol";

type Step = "ask" | "when" | "form";

type IdentifyPersonModalProps = {
  event: EventRecord;
  onReviewed: (event: EventRecord) => void;
  onPersonCreated: (person: PersonRecord) => void;
  onDismiss: () => void;
};

const PRIMARY_BUTTON =
  "rounded-md bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50";
const SECONDARY_BUTTON =
  "rounded-md bg-surface-raised px-4 py-2.5 font-semibold hover:bg-border disabled:opacity-50";
const DANGER_BUTTON =
  "rounded-md bg-live px-4 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50";

export function IdentifyPersonModal({
  event,
  onReviewed,
  onPersonCreated,
  onDismiss,
}: IdentifyPersonModalProps) {
  const [step, setStep] = useState<Step>("ask");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitReview = async (body: ReviewEventRequest) => {
    setBusy(true);
    setError(null);
    try {
      onReviewed(await reviewEvent(event.id, body));
    } catch {
      setError("Не вдалося зберегти. Перевір, чи запущений api.");
      setBusy(false);
    }
  };

  const submitPerson = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const person = await createPerson({ name: name.trim() });
      onPersonCreated(person);
      onReviewed(await reviewEvent(event.id, { status: "known", person_id: person.id }));
    } catch {
      setError("Не вдалося зберегти людину. Перевір, чи запущений api.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="identify-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
      >
        <div className="relative aspect-video bg-black">
          <img src={VISION_STREAM_URL} alt="Відео з камери" className="h-full w-full object-contain" />
          <span className="absolute left-3 top-3 rounded bg-live px-2 py-0.5 text-xs font-bold uppercase">
            Live
          </span>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-xs text-muted">
              {formatTime(event.created_at)}
              {event.confidence !== null && ` · впевненість ${Math.round(event.confidence * 100)}%`}
            </p>
            <h2 id="identify-title" className="mt-1 text-lg font-semibold">
              {step === "ask" && "У кадрі людина. Чи знаємо ми її?"}
              {step === "when" && "Заповнити дані людини зараз чи пізніше?"}
              {step === "form" && "Хто це?"}
            </h2>
          </div>

          {step === "ask" && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => setStep("when")}>
                Так, знаємо
              </button>
              <button
                type="button"
                className={DANGER_BUTTON}
                disabled={busy}
                onClick={() => submitReview({ status: "stranger", person_id: null })}
              >
                Ні, чужий
              </button>
            </div>
          )}

          {step === "when" && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => setStep("form")}>
                Зараз
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON}
                disabled={busy}
                onClick={() => submitReview({ status: "known_pending", person_id: null })}
              >
                Пізніше
              </button>
            </div>
          )}

          {step === "form" && (
            <form onSubmit={submitPerson} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted">Ім&apos;я</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(changeEvent) => setName(changeEvent.target.value)}
                  maxLength={100}
                  placeholder="Наприклад, Максим"
                  className="rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                />
              </label>
              <p className="text-xs text-muted">Фото для розпізнавання обличчя можна буде додати на сторінці «Свої».</p>
              <button type="submit" className={PRIMARY_BUTTON} disabled={busy || !name.trim()}>
                Зберегти
              </button>
            </form>
          )}

          {error && <p className="text-sm text-live">{error}</p>}

          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="self-center text-sm text-muted hover:text-foreground"
          >
            Закрити, вирішити пізніше
          </button>
        </div>
      </div>
    </div>
  );
}
