"use client";

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { Header } from "@/components/Header";
import {
  captureFace,
  createPerson,
  deletePerson,
  describeFaceError,
  describeReason,
  uploadPhotos,
} from "@/lib/api";
import { VISION_STREAM_URL } from "@/lib/config";
import type { AddPhotosResult, PersonSummary } from "@/lib/protocol";
import { usePersons } from "@/lib/usePersons";
import { useVisionHealth } from "@/lib/useVisionHealth";

const MAX_PHOTOS = 5;

type Notice = {
  tone: "ok" | "error";
  text: string;
};

const BUTTON = "rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50";
const PRIMARY = `${BUTTON} bg-accent text-accent-on hover:bg-accent-hover`;
const SECONDARY = `${BUTTON} bg-surface-2 hover:bg-border`;
const DANGER = `${BUTTON} bg-danger text-white hover:opacity-90`;

function photosNotice(result: AddPhotosResult): Notice {
  if (result.failed.length === 0) {
    return { tone: "ok", text: `Додано фото: ${result.added}` };
  }
  const reasons = result.failed.map((item) => `${item.file}: ${describeReason(item.reason)}`);
  return {
    tone: result.added > 0 ? "ok" : "error",
    text: `Додано: ${result.added}. Не прийнято — ${reasons.join("; ")}`,
  };
}

function NoticeText({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return <p className={`text-sm ${notice.tone === "ok" ? "text-ok-text" : "text-danger-text"}`}>{notice.text}</p>;
}

function PersonCard({ person, onChanged }: { person: PersonSummary; onChanged: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const run = async (action: () => Promise<Notice>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice(await action());
      onChanged();
    } catch (error) {
      setNotice({ tone: "error", text: describeFaceError(error) });
    } finally {
      setBusy(false);
    }
  };

  const capture = () => run(async () => {
    await captureFace(person.id);
    return { tone: "ok", text: "Обличчя знято з камери" };
  });

  const addFiles = (changeEvent: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(changeEvent.target.files ?? []).slice(0, MAX_PHOTOS);
    changeEvent.target.value = "";
    if (files.length) run(async () => photosNotice(await uploadPhotos(person.id, files)));
  };

  const remove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    run(async () => {
      await deletePerson(person.id);
      return { tone: "ok", text: "Видалено" };
    });
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{person.name}</span>
        <span className={`text-xs ${person.photo_count ? "text-text-muted" : "text-warn-text"}`}>
          {person.photo_count ? `Фото: ${person.photo_count}` : "Немає фото — не розпізнається"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={PRIMARY} disabled={busy} onClick={capture}>
          Зняти з камери
        </button>
        <button type="button" className={SECONDARY} disabled={busy} onClick={() => fileInput.current?.click()}>
          Додати фото
        </button>
        <button
          type="button"
          className={confirmDelete ? DANGER : SECONDARY}
          disabled={busy}
          onClick={remove}
          onBlur={() => setConfirmDelete(false)}
        >
          {confirmDelete ? "Точно видалити?" : "Видалити"}
        </button>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={addFiles} />
      </div>
      <NoticeText notice={notice} />
    </li>
  );
}

function AddPersonForm({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const person = await createPerson({ name: name.trim() });
      setNotice(
        files.length
          ? photosNotice(await uploadPhotos(person.id, files))
          : { tone: "ok", text: `${person.name} додано. Зніміть обличчя з камери в списку.` },
      );
      setName("");
      setFiles([]);
      onChanged();
    } catch (error) {
      setNotice({ tone: "error", text: describeFaceError(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">Додати людину</h2>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-text-muted">Ім&apos;я</span>
        <input
          value={name}
          onChange={(changeEvent) => setName(changeEvent.target.value)}
          maxLength={100}
          placeholder="Наприклад, Максим"
          className="rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-text-muted">Фото обличчя (до {MAX_PHOTOS}, необов&apos;язково)</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(changeEvent) => setFiles(Array.from(changeEvent.target.files ?? []).slice(0, MAX_PHOTOS))}
          className="text-sm text-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-text"
        />
      </label>
      <p className="text-xs text-text-muted">
        На кожному фото — рівно одне обличчя анфас. Тестувати лише на людях, які дали згоду.
      </p>
      <button type="submit" className={`${PRIMARY} py-2`} disabled={busy || !name.trim()}>
        {busy ? "Зберігаю…" : "Додати"}
      </button>
      <NoticeText notice={notice} />
    </form>
  );
}

export function PersonsManager() {
  const health = useVisionHealth();
  const { persons, loaded, refresh } = usePersons();

  return (
    <div className="flex min-h-screen flex-col">
      <Header live={health?.source_connected ?? false} />
      <main className="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border border-border bg-black">
            <img src={VISION_STREAM_URL} alt="Відео з камери" className="aspect-video w-full object-contain" />
          </div>
          <AddPersonForm onChanged={refresh} />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-semibold">Свої</h1>
            <span className="text-sm text-text-muted">{persons.length}</span>
          </div>
          {loaded && persons.length === 0 && (
            <p className="rounded-lg border border-border bg-surface p-6 text-center text-text-muted">
              Поки нікого немає
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {persons.map((person) => (
              <PersonCard key={person.id} person={person} onChanged={refresh} />
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
