import OpenAI from "openai";

// Second-pass matching judge. lib/match.js does cheap keyword recall on every
// keystroke; that is deliberately generous and lets false positives through
// (one shared word is enough to surface a startup). This re-reads the shortlist
// against the problem in context and decides which candidates actually solve
// it, with a plain-language reason the poster can read.
//
// Runs once per problem, never on the typing path, and is entirely optional:
// with no API key configured every export here no-ops and callers fall back to
// the raw keyword ranking.

// Overridable so the model can be changed without a deploy.
const MODEL = process.env.OPENAI_MATCH_MODEL || "gpt-5";

// A verdict is only worth storing for so long: startups edit what they say they
// solve, and the poster can edit the problem out from under an old ruling.
export const VERDICT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const client = process.env.OPENAI_API_KEY ? new OpenAI() : null;

export function agentEnabled() {
  return client !== null;
}

const SYSTEM = `You are the matching judge for Solvyard, a site where people describe real problems from their daily life and get matched with startups already solving them.

A keyword search has already produced a shortlist of candidate startups. Your job is to decide which of them genuinely solve the person's problem. The keyword pass is deliberately generous, so expect false positives: candidates that share vocabulary with the problem but solve something else entirely.

For each candidate return one verdict:
- "solves": this startup addresses the specific problem described. Someone with this exact problem could use this product today and be helped.
- "adjacent": same general space, but it does not solve the problem as described. Useful context, not an answer.
- "unrelated": the overlap is coincidental. Shared words, different problem.

Be strict. "solves" is a promise to someone who is frustrated and hoping for an answer, and a wrong promise costs more than a missed match. When a candidate only partly fits, or you would need to assume facts the startup never stated, choose "adjacent".

Judge only on what the startup says it solves. Do not credit a startup for capabilities it has not claimed.

Write each reason as one short sentence, in plain language, addressed to the person who posted the problem. Say what the product does about their specific problem. No marketing voice. Never use em dashes; use commas or a second sentence instead.`;

const SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startup_id: { type: "integer" },
          verdict: { type: "string", enum: ["solves", "adjacent", "unrelated"] },
          reason: { type: "string" },
        },
        required: ["startup_id", "verdict", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts"],
  additionalProperties: false,
};

function buildPrompt(problem, candidates) {
  const shortlist = candidates
    .map((c) => {
      const statements = (c.statements || []).map((s) => `    - ${s}`).join("\n");
      return [
        `<candidate id="${c.id}">`,
        `  name: ${c.name}`,
        c.tagline ? `  tagline: ${c.tagline}` : null,
        c.category ? `  category: ${c.category}` : null,
        c.description ? `  description: ${c.description}` : null,
        statements ? `  problems it says it solves:\n${statements}` : null,
        `</candidate>`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `<problem>
  title: ${problem.title}
  description: ${problem.description}
</problem>

<shortlist>
${shortlist}
</shortlist>

Return a verdict for every candidate in the shortlist, using the id given above.`;
}

// The model is told not to write em dashes, but this is user-facing copy on
// every problem page, so it is not left to the prompt alone.
function clean(text) {
  return String(text || "")
    .replace(/\s*—\s*/g, ", ")
    .trim();
}

// Judge a keyword shortlist. Returns a Map of startup_id -> {verdict, reason},
// or null when the agent is off or the call did not produce a usable answer.
// Never throws: matching must keep working when the model does not.
export async function judgeMatches(problem, candidates) {
  if (!client || candidates.length === 0) return null;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(problem, candidates) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "match_verdicts", schema: SCHEMA, strict: true },
      },
    });

    const message = response.choices[0]?.message;
    if (!message || message.refusal) {
      console.error("match agent: request was declined", message?.refusal || "");
      return null;
    }
    if (response.choices[0].finish_reason === "length") {
      console.error("match agent: response was truncated");
      return null;
    }
    if (!message.content) return null;

    const { verdicts } = JSON.parse(message.content);
    if (!Array.isArray(verdicts)) return null;

    const known = new Set(candidates.map((c) => c.id));
    const byStartup = new Map();
    for (const v of verdicts) {
      if (!known.has(v.startup_id)) continue;
      byStartup.set(v.startup_id, { verdict: v.verdict, reason: clean(v.reason) });
    }
    return byStartup.size > 0 ? byStartup : null;
  } catch (err) {
    console.error("match agent failed:", err.message);
    return null;
  }
}
