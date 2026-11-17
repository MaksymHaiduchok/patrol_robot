"use client";

import { Camera, Check, Info, Plus, RotateCw, Search, TriangleAlert, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError, captureFace, createPerson, describeFaceError, reviewEvent, snapshotUrl } from "@/lib/api";
import { VISION_STREAM_URL } from "@/lib/config";
import { formatTime } from "@/lib/eventLabels";
import { descriptionPending } from "@/lib/eventView";
import type { EventRecord, PersonSummary } from "@/lib/protocol";
import { useNow } from "@/lib/useNow";

type Step = "ask" | "choose" | "new" | "error" | "done";

type Target = {
  id: string;
  name: string;
};

type CaptureError = {
  title: string;
  text: string;
};

type IdentifyModalProps = {
  event: EventRecord;
  queuePosition: number;
  queueTotal: number;
  persons: PersonSummary[];
  robotId: string;
  onFinished: (event: EventRecord) => void;
  onMarkedStranger: (event: EventRecord) => void;
  onPersonsChanged: () => void;
  onDismiss: () => void;
};

const CAPTURE_ERRORS: Record<string, CaptureError> = {
  no_face: {
    title: "Обличчя не знайдено — подивіться прямо в камеру",
    text: "Людина відвернулась або обличчя закрите. Попросіть подивитися в камеру анфас.",
  },
  multiple_faces: {
    title: "У кадрі кілька облич",
    text: "Залиште в кадрі лише одну людину й зніміть ще раз.",
  },
};

function captureError(error: unknown): CaptureError {
  if (error instanceof ApiError && CAPTURE_ERRORS[error.message]) return CAPTURE_ERRORS[error.message];
  return { title: "Не вдалося зняти обличчя", text: describeFaceError(error) };
}

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function MediaTile({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <div className="relative aspect-video overflow-hidden rounded-md bg-black">{children}</div>
      <figcaption className="text-caption text-text-muted">{caption}</figcaption>
    </figure>
  );
}

function SnapshotPlaceholder() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="text-border-strong">
      <rect width="160" height="90" className="fill-surface" />
      <circle cx="70" cy="28" r="8" fill="currentColor" />
      <path d="M56 90V50a14 14 0 0 1 28 0v40z" fill="currentColor" />
      <rect x="54" y="16" width="32" height="74" fill="none" strokeWidth="1.4" className="stroke-ev-stranger" />
    </svg>
  );
}

export function IdentifyModal({
  event,
  queuePosition,
  queueTotal,
  persons,
  robotId,
  onFinished,
  onMarkedStranger,
  onPersonsChanged,
  onDismiss,
}: IdentifyModalProps) {
  const [step, setStep] = useState<Step>("ask");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(persons[0]?.id ?? null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CaptureError | null>(null);
  const [reviewed, setReviewed] = useState<EventRecord | null>(null);
  const now = useNow();
  const snapshot = snapshotUrl(event);
  const describing = now !== null && descriptionPending(event, now);

  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape" || busy) return;
      if (reviewed) onFinished(reviewed);
      else onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, reviewed, onDismiss, onFinished]);

  const filtered = persons.filter((person) => person.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = persons.find((person) => person.id === selectedId) ?? null;
  const hasNext = queuePosition < queueTotal;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const captureAndReview = async (person: Target) => {
    setTarget(person);
    try {
      await captureFace(person.id);
    } catch (captureFailure) {
      onPersonsChanged();
      setError(captureError(captureFailure));
      setStep("error");
      return;
    }
    onPersonsChanged();
    setReviewed(await reviewEvent(event.id, { status: "known", person_id: person.id }));
    setStep("done");
  };

  const markStranger = () =>
    run(async () => {
      try {
        onMarkedStranger(await reviewEvent(event.id, { status: "stranger", person_id: null }));
      } catch (failure) {
        setError({ title: "Не вдалося зберегти", text: describeFaceError(failure) });
      }
    });

  const fillLater = () =>
    run(async () => {
      try {
        onFinished(await reviewEvent(event.id, { status: "known_pending", person_id: null }));
      } catch (failure) {
        setError({ title: "Не вдалося зберегти", text: describeFaceError(failure) });
      }
    });

  const addToSelected = () => {
    if (!selected) return;
    run(() => captureAndReview({ id: selected.id, name: selected.name }));
  };

  const createAndCapture = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!name.trim()) return;
    run(async () => {
      try {
        const person = await createPerson({ name: name.trim() });
        await captureAndReview({ id: person.id, name: person.name });
      } catch (failure) {
        setError({ title: "Не вдалося зберегти людину", text: describeFaceError(failure) });
        setStep("error");
      }
    });
  };

  const retryCapture = () => {
    if (!target) return;
    run(() => captureAndReview(target));
  };

  const saveWithoutPhoto = () => {
    if (!target) return;
    run(async () => {
      onFinished(await reviewEvent(event.id, { status: "known", person_id: target.id }));
    });
  };

  const finish = () => {
    if (reviewed) onFinished(reviewed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identify-title"
      className="flex w-full max-w-[560px] flex-col rounded-xl border border-border-strong bg-surface text-text shadow-modal"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <span className="size-2.5 rounded-full bg-danger" />
        <h2 id="identify-title" className="m-0 flex-1 text-title font-semibold">
          Чи знаємо ми цю людину?
        </h2>
        <span className="rounded-full bg-surface-3 px-[9px] py-[3px] font-mono text-caption font-semibold">
          {queuePosition} з {queueTotal}
        </span>
        <button
          type="button"
          aria-label="Закрити"
          onClick={onDismiss}
          disabled={busy}
          className="inline-flex size-8 items-center justify-center rounded-sm text-text-muted hover:text-text"
        >
          <X aria-hidden className="size-[18px]" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pt-4">
        <MediaTile caption="Живе відео">
          <img src={VISION_STREAM_URL} alt="Живе відео з камери" className="h-full w-full object-contain" />
          <span className="absolute left-2 top-2 inline-flex h-5 items-center gap-[5px] rounded-xs bg-danger px-1.5 text-[11px] font-bold text-white">
            <span className="size-[5px] rounded-full bg-white" />
            LIVE
          </span>
        </MediaTile>
        <MediaTile caption="Знімок моменту події">
          {snapshot ? (
            <img src={snapshot} alt="Знімок моменту події" className="h-full w-full object-contain" />
          ) : (
            <SnapshotPlaceholder />
          )}
        </MediaTile>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 pt-2.5 text-small text-text-muted">
        <span>
          Час <span className="font-mono text-text">{formatTime(event.created_at)}</span>
        </span>
        <span>
          {/* TODO: передавати з vision найкращу схожість обличчя з базою для stranger_detected. */}
          Схожість з базою <span className="font-mono text-text">—</span>
        </span>
        <span>
          Камера <span className="font-mono text-text">{robotId}</span>
        </span>
      </div>

      <div className="flex flex-col gap-3.5 px-5 py-4">
        {step === "ask" && (
          <>
            <p className="m-0 text-[16px] font-semibold leading-[23px]">У кадрі незнайома людина. Чи знаємо ми її?</p>
            {event.description && (
              <div className="rounded-md bg-surface-2 px-3 py-2.5 text-small text-text">
                <span className="font-semibold text-accent-text">Опис ШІ.</span> {event.description}
              </div>
            )}
            {!event.description && describing && (
              <div className="rounded-md bg-surface-2 px-3 py-2.5 text-small text-text-muted">Опис формується…</div>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="primary" size="lg" disabled={busy} onClick={() => setStep("choose")}>
                Так, знаємо
              </Button>
              <Button variant="danger" size="lg" disabled={busy} onClick={markStranger}>
                Ні, чужий
              </Button>
            </div>
          </>
        )}

        {step === "choose" && (
          <>
            <p className="m-0 text-heading font-semibold">Хто це?</p>
            <div className="flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-bg px-3 text-text-muted">
              <Search aria-hidden className="size-4" />
              <input
                aria-label="Пошук серед своїх"
                placeholder="Пошук за ім'ям"
                value={search}
                onChange={(changeEvent) => setSearch(changeEvent.target.value)}
                className="flex-1 border-0 bg-transparent text-body text-text outline-none"
              />
            </div>
            <div role="radiogroup" aria-label="Свої" className="flex max-h-[196px] flex-col gap-1 overflow-auto">
              {filtered.length === 0 && (
                <span className="px-2.5 py-2 text-small text-text-muted">Нікого не знайдено</span>
              )}
              {filtered.map((person) => {
                const checked = person.id === selectedId;
                return (
                  <button
                    key={person.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setSelectedId(person.id)}
                    className={`flex items-center gap-3 rounded-md border px-2.5 py-2 text-left text-body ${
                      checked ? "border-accent bg-accent/12" : "border-transparent bg-surface-2"
                    }`}
                  >
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-ev-own/20 text-caption font-bold text-[#93a8ff]">
                      {initials(person.name)}
                    </span>
                    <span className="flex flex-1 flex-col gap-px">
                      <span className="font-semibold">{person.name}</span>
                      <span className={`text-caption ${person.photo_count ? "text-text-muted" : "text-warn-text"}`}>
                        {person.photo_count ? `${person.photo_count} фото` : "Немає фото — не розпізнається"}
                      </span>
                    </span>
                    <span
                      className={`inline-flex size-[18px] items-center justify-center rounded-full border-2 ${
                        checked ? "border-accent" : "border-border-strong"
                      }`}
                    >
                      {checked && <span className="size-2 rounded-full bg-accent" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="dashed" icon={<Plus aria-hidden className="size-4" />} disabled={busy} onClick={() => setStep("new")}>
                Нова людина
              </Button>
              <Button variant="outline" disabled={busy} onClick={fillLater}>
                Заповнити пізніше
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setStep("ask")}>
                Назад
              </Button>
              <Button variant="primary" disabled={!selected} loading={busy} loadingText="Зберігаю…" onClick={addToSelected}>
                {selected ? `Додати обличчя до «${selected.name}»` : "Оберіть людину"}
              </Button>
            </div>
          </>
        )}

        {step === "new" && (
          <form onSubmit={createAndCapture} className="flex flex-col gap-3.5">
            <p className="m-0 text-heading font-semibold">Нова людина</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="identify-name" className="text-small text-text-muted">
                Ім&apos;я
              </label>
              <input
                id="identify-name"
                autoFocus
                value={name}
                maxLength={100}
                onChange={(changeEvent) => setName(changeEvent.target.value)}
                className="h-10 rounded-sm border border-border-strong bg-bg px-3 text-body text-text outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/30"
              />
            </div>
            <p className="m-0 flex gap-2 text-small text-text-muted">
              <Info aria-hidden className="mt-px size-4 shrink-0" />
              Обличчя знімемо з живого відео. Попросіть людину подивитися прямо в камеру.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setStep("choose")}>
                Назад
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!name.trim()}
                loading={busy}
                loadingText="Зберігаю…"
                icon={<Camera aria-hidden className="size-4" />}
              >
                Зберегти й зняти обличчя
              </Button>
            </div>
          </form>
        )}

        {step === "error" && error && (
          <>
            <div role="alert" className="flex gap-3 rounded-md border border-warn-border bg-ev-unknown/10 px-3.5 py-3">
              <TriangleAlert aria-hidden className="size-5 shrink-0 text-warn-text" />
              <div className="flex flex-col gap-[3px]">
                <span className="text-heading font-semibold text-warn-text">{error.title}</span>
                <span className="text-small text-text">{error.text}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={busy || !target} onClick={saveWithoutPhoto}>
                Без фото
              </Button>
              <Button
                variant="primary"
                disabled={!target}
                loading={busy}
                loadingText="Зберігаю…"
                icon={<RotateCw aria-hidden className="size-4" />}
                onClick={retryCapture}
              >
                Зняти ще раз
              </Button>
            </div>
            <p className="m-0 text-caption text-text-muted">
              «Без фото» — людину збережено, але поки її не розпізнаватимуть. Фото можна додати на сторінці «Свої».
            </p>
          </>
        )}

        {step === "done" && target && (
          <>
            <div role="status" className="flex items-start gap-3 rounded-md border border-ok/40 bg-ok/10 px-3.5 py-3">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ok text-bg">
                <Check aria-hidden className="size-4" strokeWidth={3} />
              </span>
              <div className="flex flex-col gap-[3px]">
                <span className="text-heading font-semibold">Обличчя додано до «{target.name}»</span>
                <span className="text-small text-text">
                  Подію позначено як «Свій: {target.name}». Наступного разу система впізнає його впевненіше.
                </span>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="primary" onClick={finish}>
                {hasNext ? `Наступна людина (${queuePosition + 1} з ${queueTotal})` : "Готово"}
              </Button>
            </div>
          </>
        )}

        {step !== "error" && error && <p className="m-0 text-small text-danger-text">{error.text}</p>}
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={reviewed ? finish : onDismiss}
          disabled={busy}
          className="h-9 px-1.5 text-body font-medium text-text-muted underline underline-offset-[3px] hover:text-text"
        >
          Закрити, вирішити пізніше
        </button>
        <span className="text-caption text-ev-left">Esc</span>
      </div>
    </div>
  );
}
