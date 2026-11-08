"use client";

import { type FormEvent, useState } from "react";
import { captureFace, createPerson, describeFaceError, reviewEvent } from "@/lib/api";
import { VISION_STREAM_URL } from "@/lib/config";
import { formatTime } from "@/lib/eventLabels";
import type { EventRecord, ReviewEventRequest } from "@/lib/protocol";

type Step = "ask" | "when" | "form" | "retry";

type IdentifyPersonModalProps = {
  event: EventRecord;
  onReviewed: (event: EventRecord) => void;
  onPersonsChanged: () => void;
  onDismiss: () => void;
};

const TITLES: Record<Step, string> = {
  ask: "У кадрі незнайома людина. Чи знаємо ми її?",
  when: "Заповнити дані людини зараз чи пізніше?",
  form: "Хто це?",
  retry: "Не вдалося зняти обличчя",
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
  onPersonsChanged,
  onDismiss,
}: IdentifyPersonModalProps) {
  const [step, setStep] = useState<Step>("ask");
  const [name, setName] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, fallbackMessage: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(fallbackMessage);
    } finally {
      setBusy(false);
    }
  };

  const submitReview = (body: ReviewEventRequest) =>
    run(async () => onReviewed(await reviewEvent(event.id, body)), "Не вдалося зберегти. Перевір, чи запущений api.");

  const captureAndReview = async (id: string) => {
    try {
      await captureFace(id);
    } catch (captureError) {
      setError(describeFaceError(captureError));
      setStep("retry");
      onPersonsChanged();
      return;
    }
    onPersonsChanged();
    onReviewed(await reviewEvent(event.id, { status: "known", person_id: id }));
  };

  const submitPerson = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!name.trim()) return;
    run(async () => {
      const person = await createPerson({ name: name.trim() });
      setPersonId(person.id);
      await captureAndReview(person.id);
    }, "Не вдалося зберегти людину. Перевір, чи запущений api.");
  };

  const retryCapture = () => {
    if (!personId) return;
    run(() => captureAndReview(personId), "Не вдалося зберегти. Перевір, чи запущений api.");
  };

  const saveWithoutPhoto = () => {
    if (!personId) return;
    submitReview({ status: "known", person_id: personId });
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
              {TITLES[step]}
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
              <p className="text-xs text-muted">
                Після збереження обличчя знімається з камери — людина має дивитися в камеру.
              </p>
              <button type="submit" className={PRIMARY_BUTTON} disabled={busy || !name.trim()}>
                {busy ? "Зберігаю…" : "Зберегти й зняти обличчя"}
              </button>
            </form>
          )}

          {step === "retry" && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={retryCapture}>
                Зняти ще раз
              </button>
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={saveWithoutPhoto}>
                Без фото
              </button>
            </div>
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
