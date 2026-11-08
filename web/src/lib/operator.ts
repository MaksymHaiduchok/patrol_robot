export type Operator = {
  name: string;
  shortName: string;
  initials: string;
  role: string;
};

// TODO: брати з Supabase Auth, коли з'явиться вхід оператора (етап 9).
export const OPERATOR_STUB: Operator = {
  name: "Максим Гайдучок",
  shortName: "Максим",
  initials: "МГ",
  role: "Оператор",
};
