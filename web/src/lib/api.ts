import { API_URL } from "@/lib/config";
import type {
  AddPhotosResult,
  CreatePersonRequest,
  EventRecord,
  EventsPage,
  PersonRecord,
  PersonSummary,
  ReviewEventRequest,
} from "@/lib/protocol";

type ErrorBody = {
  message?: string | string[];
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, cache: "no-store" });
  if (!response.ok) {
    const body: ErrorBody = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new ApiError(response.status, message ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export function fetchEvents(limit: number, offset: number): Promise<EventsPage> {
  return request(`/events?limit=${limit}&offset=${offset}`);
}

export function reviewEvent(id: string, body: ReviewEventRequest): Promise<EventRecord> {
  return request(`/events/${id}/review`, json("PATCH", body));
}

export function fetchPersons(): Promise<PersonSummary[]> {
  return request("/persons");
}

export function createPerson(body: CreatePersonRequest): Promise<PersonRecord> {
  return request("/persons", json("POST", body));
}

export function uploadPhotos(personId: string, files: File[]): Promise<AddPhotosResult> {
  const form = new FormData();
  for (const file of files) form.append("photos", file);
  return request(`/persons/${personId}/photos`, { method: "POST", body: form });
}

export function captureFace(personId: string): Promise<AddPhotosResult> {
  return request(`/persons/${personId}/capture`, { method: "POST" });
}

export function deletePerson(personId: string): Promise<void> {
  return request(`/persons/${personId}`, { method: "DELETE" });
}

const FACE_ERRORS: Record<string, string> = {
  no_face: "Обличчя не знайдено — подивіться прямо в камеру",
  multiple_faces: "У кадрі кілька облич — має бути одне",
  invalid_image: "Не вдалося прочитати зображення",
};

export function describeFaceError(error: unknown): string {
  if (error instanceof ApiError) {
    if (FACE_ERRORS[error.message]) return FACE_ERRORS[error.message];
    if (error.status === 502) return "Vision недоступний — перевір, чи він запущений";
    return error.message;
  }
  return "Немає зв'язку з api";
}

export function describeReason(reason: string): string {
  return FACE_ERRORS[reason] ?? reason;
}
