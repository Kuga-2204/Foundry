import crypto from "crypto";

// Short, neutral two-word handles keep anonymous posters recognisable without
// leaking anything about their real identity.
const FIRST_WORDS = [
  "Amber", "Bright", "Calm", "Cedar", "Clear", "Cobalt", "Dawn", "Ember",
  "Fable", "Fern", "Harbor", "Indigo", "Juniper", "Kindred", "Lumen", "Moss",
  "North", "Nova", "Quiet", "River", "Sage", "Solar", "True", "Velvet",
];
const SECOND_WORDS = [
  "Atlas", "Beacon", "Circuit", "Compass", "Harbor", "Lantern", "Map", "Meadow",
  "Notebook", "Orbit", "Pine", "Signal", "Sky", "Spark", "Stone", "Trail",
  "Vale", "Wave", "Willow", "Workshop",
];

export function normaliseAnonymousHandle(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function validateAnonymousHandle(value) {
  const handle = normaliseAnonymousHandle(value);
  if (!handle) return { handle: "" };
  if (handle.length < 3 || handle.length > 30) {
    return { error: "Anonymous name must be between 3 and 30 characters." };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]*[A-Za-z0-9]$/.test(handle)) {
    return { error: "Anonymous name can use letters, numbers, spaces, hyphens, and underscores." };
  }
  return { handle };
}

export function anonymousHandleCandidates() {
  const candidates = new Set();
  while (candidates.size < 10) {
    const first = FIRST_WORDS[crypto.randomInt(FIRST_WORDS.length)];
    const second = SECOND_WORDS[crypto.randomInt(SECOND_WORDS.length)];
    candidates.add(`${first} ${second}`);
  }
  // A suffix is only needed after the first set of memorable combinations.
  const fallback = `Quiet Signal ${crypto.randomInt(100, 1000)}`;
  return [...candidates, fallback];
}

// Anonymous problems keep their real user_id in the database (stake checks,
// dashboards, and notifications still work), but every API response must hide
// who posted them. Call this on any problem row that leaves the server.
export function maskAnonymous(problem, viewerId = null) {
  if (!problem || !problem.is_anonymous) return problem;
  return {
    ...problem,
    author_name: problem.anon_handle || "Anonymous",
    user_id: null,
    isMine: !!viewerId && problem.user_id === viewerId,
  };
}
