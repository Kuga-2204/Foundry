// Language filter for user-generated text. Solvyard runs on people describing
// frustrations, so criticism is welcome; abuse and profanity are not. This
// cannot judge whether a claim is TRUE (no wordlist can); false-review defense
// lives in the stake-gated review rules instead.

const BLOCKED = [
  "fuck", "fucking", "fucker", "motherfucker", "shit", "bullshit", "shitty",
  "bitch", "bitches", "asshole", "arsehole", "bastard", "cunt", "dick",
  "dickhead", "prick", "pussy", "slut", "whore", "wanker", "twat", "douche",
  "douchebag", "jackass", "dumbass", "piss", "pissed",
  "retard", "retarded", "faggot", "fag", "nigger", "nigga", "tranny", "chink",
  "spic", "kike",
  "kill yourself", "kys", "go die",
];

// Leetspeak and symbol substitutions people use to slip past filters.
const SUBS = { "@": "a", "4": "a", "3": "e", "1": "i", "!": "i", "0": "o", "$": "s", "5": "s", "7": "t" };

function normalize(text) {
  let t = String(text || "").toLowerCase();
  t = t.replace(/[@43!10$57]/g, (ch) => SUBS[ch] || ch);
  t = t.replace(/(.)\1{2,}/g, "$1$1"); // fuuuuck -> fuuck
  return t;
}

const PATTERNS = BLOCKED.map(
  (w) => new RegExp(`(^|[^a-z])${w.replace(/ /g, "[^a-z]+")}([^a-z]|$)`, "i")
);

// Returns null when the text is fine, or a friendly error message when not.
export function moderate(...texts) {
  const combined = normalize(texts.filter(Boolean).join(" \n "));
  for (const re of PATTERNS) {
    if (re.test(combined)) {
      return "Let's keep it constructive: please remove the offensive language and try again.";
    }
  }
  return null;
}
