// Timestamps come from SQLite as UTC. New rows are ISO with a Z suffix;
// rows from before the pivot are "YYYY-MM-DD HH:MM:SS" with no marker, so we
// normalize before parsing to avoid timezone drift and Safari parse failures.
export function parseDate(value) {
  if (!value) return null;
  let s = String(value);
  if (!s.includes("T")) s = s.replace(" ", "T");
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s += "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value, options) {
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString(undefined, options);
}

export const STATUS_LABELS = {
  open: "Open",
  building: "In progress",
  solved: "Solved",
};

export const STATUS_COLORS = {
  open: "var(--spark)",
  building: "var(--signal)",
  solved: "var(--build)",
};

export const OUTCOME_LABELS = {
  solved: "Solved it",
  partial: "Partially solved",
  unsolved: "Did not solve it",
};

export const OUTCOME_COLORS = {
  solved: "var(--build)",
  partial: "var(--spark)",
  unsolved: "var(--signal)",
};
