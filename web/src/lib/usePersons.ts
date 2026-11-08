"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPersons } from "@/lib/api";
import type { PersonSummary } from "@/lib/protocol";

type Persons = {
  persons: PersonSummary[];
  names: Map<string, string>;
  loaded: boolean;
  refresh: () => void;
};

export function usePersons(): Persons {
  const [persons, setPersons] = useState<PersonSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    fetchPersons()
      .then(setPersons)
      .catch(() => setPersons([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(refresh, [refresh]);

  const names = useMemo(
    () => new Map(persons.map((person) => [person.id, person.name])),
    [persons],
  );

  return { persons, names, loaded, refresh };
}
