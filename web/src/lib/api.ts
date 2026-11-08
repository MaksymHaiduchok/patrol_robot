import { API_URL } from "@/lib/config";
import type {
  CreatePersonRequest,
  EventRecord,
  EventsPage,
  PersonRecord,
  ReviewEventRequest,
} from "@/lib/protocol";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export function fetchEvents(limit: number, offset: number): Promise<EventsPage> {
  return request(`/events?limit=${limit}&offset=${offset}`);
}

export function reviewEvent(id: string, body: ReviewEventRequest): Promise<EventRecord> {
  return request(`/events/${id}/review`, { method: "PATCH", body: JSON.stringify(body) });
}

export function fetchPersons(): Promise<PersonRecord[]> {
  return request("/persons");
}

export function createPerson(body: CreatePersonRequest): Promise<PersonRecord> {
  return request("/persons", { method: "POST", body: JSON.stringify(body) });
}
