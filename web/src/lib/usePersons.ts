"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPersons } from "@/lib/api";
import type { PersonRecord } from "@/lib/protocol";

type Persons = {
  names: Map<string, string>;
  addPerson: (person: PersonRecord) => void;
};

export function usePersons(): Persons {
  const [persons, setPersons] = useState<PersonRecord[]>([]);

  useEffect(() => {
    fetchPersons()
      .then(setPersons)
      .catch(() => setPersons([]));
  }, []);

  const addPerson = useCallback((person: PersonRecord) => {
    setPersons((current) => [...current, person]);
  }, []);

  const names = new Map(persons.map((person) => [person.id, person.name]));

  return { names, addPerson };
}
