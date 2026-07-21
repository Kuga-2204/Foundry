import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import StartupCard from "../components/StartupCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const MAX_FILES = 4;
const MAX_FILE_MB = 30;
const DRAFT_KEY = "sy_post_draft";

// Derive a title from the complaint when the user doesn't give one: first
// line, trimmed to a sentence-ish length on a word boundary.
function deriveTitle(body) {
  const firstLine = String(body).split("\n")[0].trim();
  if (firstLine.length <= 80) return firstLine;
  const cut = firstLine.slice(0, 80);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

// Post a problem. Quick by default: one complaint box, with title/category/
// media tucked under "more options". Two live checks run while typing (does a
// startup already solve this; is it already listed). The draft autosaves, and
// people can write before signing up — the submit step gates on auth.
export default function PostProblem() {
  const { token, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", category: "General" });
  const [anonymous, setAnonymous] = useState(false);
  const [anonymousHandle, setAnonymousHandle] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [files, setFiles] = useState([]);
  const [matches, setMatches] = useState({ strong: [], adjacent: [] });
  const [similar, setSimilar] = useState([]);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const debounceRef = useRef(null);
  const fileInputRef = useRef(null);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setForm({ title: "", description: "", category: "General" });
    setAnonymous(false);
    setAnonymousHandle("");
    setDraftRestored(false);
    setSavedAt(null);
  };

  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories));
  }, []);

  // Restore any saved draft on mount (survives navigating away to sign up).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (saved && (saved.description || saved.title)) {
        setForm({
          title: saved.title || "",
          description: saved.description || "",
          category: saved.category || "General",
        });
        setAnonymous(!!saved.anonymous);
        setAnonymousHandle(saved.anonymousHandle || "");
        if (saved.title || saved.category !== "General" || saved.anonymous) setShowDetails(true);
        setDraftRestored(true);
      }
    } catch {
      /* ignore malformed draft */
    }
  }, []);

  // Autosave the text draft (files can't be persisted; that's fine).
  useEffect(() => {
    const hasContent = form.title.trim() || form.description.trim();
    if (hasContent) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, anonymous, anonymousHandle }));
      setSavedAt(Date.now());
    }
  }, [form, anonymous, anonymousHandle]);

  const text = `${form.title} ${form.description}`.trim();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (text.length < 12) {
      setMatches({ strong: [], adjacent: [] });
      setSimilar([]);
      setChecked(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      Promise.all([api.matchText(text, token), api.similarProblems(text, token)])
        .then(([matchData, similarData]) => {
          setMatches(matchData);
          setSimilar(similarData.similar);
          setChecked(true);
        })
        .catch(() => {});
    }, 450);
    return () => clearTimeout(debounceRef.current);
  }, [text, token]);

  // Back an existing listing straight from the duplicate panel: the whole
  // point of showing duplicates is that voting is the better move.
  const upvoteSimilar = async (problemId) => {
    if (!token) {
      setError("Log in to vote on an existing problem.");
      return;
    }
    try {
      const data = await api.vote(problemId, 1, token);
      setSimilar((prev) => prev.map((p) => (p.id === problemId ? data.problem : p)));
    } catch (err) {
      setError(err.message);
    }
  };

  // Object URLs for previews; revoked when files change or the page unmounts.
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const urls = files.map((f) => ({
      url: URL.createObjectURL(f),
      isVideo: f.type.startsWith("video/"),
      name: f.name,
    }));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u.url));
  }, [files]);

  const addFiles = (list) => {
    setError("");
    const incoming = Array.from(list);
    const next = [...files];
    for (const f of incoming) {
      if (next.length >= MAX_FILES) {
        setError(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
        setError(`"${f.name}" isn't an image or video.`);
        continue;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`"${f.name}" is over ${MAX_FILE_MB}MB.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const description = form.description.trim();
    if (!description) {
      setError("Describe the problem before posting.");
      return;
    }
    const title = form.title.trim() || deriveTitle(description);

    // Post now, account later: if they're not signed in, keep the draft
    // (already autosaved) and send them to sign up, returning here after.
    if (!token) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, title, anonymous, anonymousHandle }));
      navigate("/register?next=/post");
      return;
    }

    setBusy(true);
    try {
      let payload;
      if (files.length > 0) {
        payload = new FormData();
        payload.append("title", title);
        payload.append("description", description);
        payload.append("category", form.category);
        payload.append("anonymous", anonymous ? "true" : "false");
        if (anonymous && anonymousHandle.trim()) payload.append("anonymousHandle", anonymousHandle.trim());
        files.forEach((f) => payload.append("media", f));
      } else {
        payload = { title, description, category: form.category, anonymous, anonymousHandle };
      }
      const data = await api.createProblem(payload, token);
      if (anonymous) await refreshUser();
      localStorage.removeItem(DRAFT_KEY);
      navigate(`/problems/${data.problem.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const hasMatches = matches.strong.length > 0;

  return (
    <div className="wrap" style={styles.wrap}>
      <div style={styles.columns}>
        <div className="card" style={styles.card}>
          <h1 style={styles.h1}>What's bugging you?</h1>
          <p style={styles.sub}>
            Describe it like you'd complain to a friend. We'll check if a startup already
            solves it; if not, you'll be the first to know when one picks it up.
          </p>

          {error && <div className="error-banner">{error}</div>}

          {draftRestored && (
            <div style={styles.draftBanner}>
              <span>We kept the draft you started earlier.</span>
              <button type="button" onClick={clearDraft} style={styles.draftClear}>Start fresh</button>
            </div>
          )}

          <form onSubmit={submit}>
            <div className="field">
              <textarea
                autoFocus
                rows={6}
                placeholder="e.g. Splitting rent with flatmates always turns into an argument about who used what…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={styles.mainInput}
              />
            </div>

            {!showDetails ? (
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                style={styles.moreToggle}
              >
                + Add a title, category, or photos
              </button>
            ) : (
              <div style={styles.detailsBox}>
                <div className="field">
                  <label>Title <span style={styles.optional}>(optional — we'll make one from your description)</span></label>
                  <input
                    placeholder='e.g. "No fair way to split rent by usage"'
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Photos or videos (optional)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ alignSelf: "flex-start" }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={files.length >= MAX_FILES}
                  >
                    + Add photos / videos ({files.length}/{MAX_FILES})
                  </button>
                  {previews.length > 0 && (
                    <div style={styles.previewRow}>
                      {previews.map((p, i) => (
                        <div key={p.url} style={styles.previewThumb}>
                          {p.isVideo ? (
                            <video src={p.url} style={styles.previewMedia} muted />
                          ) : (
                            <img src={p.url} alt={p.name} style={styles.previewMedia} />
                          )}
                          <button
                            type="button"
                            aria-label={`Remove ${p.name}`}
                            style={styles.previewRemove}
                            onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                          >
                            ×
                          </button>
                          {p.isVideo && <span style={styles.videoTag}>video</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <label style={styles.anonRow}>
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Post anonymously</span>
                    <span style={styles.anonHint}>
                      Your name won't be shown. Your anonymous name stays linked to your account
                      privately, so you will still get updates and can review fixes.
                    </span>
                    {anonymous && (
                      <span style={styles.anonHandleWrap}>
                        <label htmlFor="anonymous-handle" style={styles.anonHandleLabel}>Anonymous name</label>
                        <input
                          id="anonymous-handle"
                          value={anonymousHandle}
                          onChange={(e) => setAnonymousHandle(e.target.value)}
                          placeholder={user?.anon_handle || "e.g. Quiet Compass"}
                          maxLength={30}
                          style={styles.anonHandleInput}
                        />
                        <span style={styles.anonHandleHelp}>
                          {user?.anon_handle
                            ? `Your name is “${user.anon_handle}”. You can change it here anytime — it updates on all your anonymous posts.`
                            : "Leave blank and we'll make you a memorable, unique name. You can change it later."}
                        </span>
                      </span>
                    )}
                  </span>
                </label>
              </div>
            )}

            <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
              {busy
                ? "Posting…"
                : !user
                ? "Continue to post →"
                : hasMatches
                ? "None of these fit, post my problem"
                : "Post problem"}
            </button>
            {!user && (
              <p style={styles.authNote}>
                Write it now — we'll ask you to create a quick account to publish, and your
                draft is saved.
              </p>
            )}
            {savedAt && (
              <p style={styles.savedNote}>✓ Draft saved automatically. It'll be here if you come back.</p>
            )}
          </form>
        </div>

        <div style={styles.matchPanel}>
          {similar.length > 0 && (
            <div style={styles.dupBox}>
              <p className="mono" style={styles.dupLabel}>IS IT ALREADY LISTED?</p>
              <p style={styles.dupText}>
                These look close to yours. If one is the same problem, vote it up instead:
                one listing with 40 votes beats four listings with 10.
              </p>
              {similar.map((p) => (
                <div key={p.id} style={styles.dupItem}>
                  <Link to={`/problems/${p.id}`} style={styles.dupTitle}>{p.title}</Link>
                  <span style={styles.dupMeta}>
                    <StatusBadge status={p.status} />
                    <span>↑ {p.score}</span>
                    <span>{p.followerCount} following</span>
                  </span>
                  <div style={styles.dupActions}>
                    <button
                      type="button"
                      className={`btn btn-sm ${p.myVote === 1 ? "btn-spark" : ""}`}
                      onClick={() => upvoteSimilar(p.id)}
                    >
                      {p.myVote === 1 ? "✓ You're waiting on this" : "↑ I have this too"}
                    </button>
                    <Link to={`/problems/${p.id}#discussion`} className="btn btn-sm">
                      Add details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!checked ? (
            <div style={styles.matchIdle}>
              <p className="mono" style={styles.matchIdleLabel}>LIVE CHECK</p>
              <p style={styles.matchIdleText}>
                Start typing and we'll search the startup directory for someone who already
                solves this, and check whether it's already listed.
              </p>
            </div>
          ) : hasMatches ? (
            <div>
              <p className="mono" style={styles.matchFoundLabel}>
                {matches.strong.length} STARTUP{matches.strong.length > 1 ? "S" : ""} MAY ALREADY SOLVE THIS
              </p>
              <p style={styles.matchFoundText}>
                Check these before posting; your fix might already exist.
              </p>
              {matches.strong.map((s) => (
                <StartupCard key={s.id} startup={s} matched />
              ))}
            </div>
          ) : (
            <div style={styles.noMatch}>
              <p className="mono" style={styles.noMatchLabel}>NO STARTUP SOLVES THIS YET</p>
              <p style={styles.noMatchText}>
                You're the first to raise it. Post it, and the moment a startup commits to a
                fix or ships one, you'll hear about it.
              </p>
              {matches.adjacent.length > 0 && (
                <>
                  <p style={styles.adjacentNote}>Working nearby, but not on this exactly:</p>
                  {matches.adjacent.slice(0, 3).map((s) => (
                    <StartupCard key={s.id} startup={s} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: "48px 28px 80px" },
  columns: { display: "flex", gap: 28, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" },
  card: { width: 520, maxWidth: "100%", padding: 36 },
  h1: { fontSize: 26, marginBottom: 8 },
  sub: { fontSize: 14, color: "var(--text-dim)", marginBottom: 24, lineHeight: 1.5 },
  mainInput: { fontSize: 15.5, lineHeight: 1.55, padding: "13px 14px" },
  moreToggle: {
    background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: 2,
    fontSize: 13.5, fontWeight: 600, color: "var(--build)", fontFamily: "inherit",
  },
  detailsBox: { marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" },
  optional: { fontWeight: 400, fontSize: 12, color: "var(--text-dim)" },
  authNote: { fontSize: 12.5, color: "var(--text-dim)", textAlign: "center", marginTop: 10, lineHeight: 1.45 },
  savedNote: { fontSize: 12, color: "var(--build)", textAlign: "center", marginTop: 8 },
  draftBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    background: "var(--paper-dim)", border: "1.5px solid var(--line)", borderRadius: 4,
    padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--text)",
  },
  draftClear: {
    background: "none", border: "none", padding: 0, cursor: "pointer",
    fontSize: 13, fontWeight: 600, color: "var(--signal)", fontFamily: "inherit", flexShrink: 0,
  },
  previewRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 },
  previewThumb: {
    position: "relative", width: 92, height: 92, borderRadius: 3,
    border: "1.5px solid var(--line)", overflow: "hidden", background: "var(--paper-dim)",
  },
  previewMedia: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  previewRemove: {
    position: "absolute", top: 3, right: 3, width: 22, height: 22, lineHeight: "20px",
    borderRadius: 2, border: "none", background: "var(--ink)", color: "var(--paper)",
    fontSize: 15, cursor: "pointer", padding: 0,
  },
  videoTag: {
    position: "absolute", bottom: 3, left: 3, fontFamily: "var(--mono)", fontSize: 10,
    background: "var(--ink)", color: "var(--paper)", padding: "1px 5px", borderRadius: 2,
  },
  anonRow: {
    display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 20,
    padding: "12px 14px", border: "1.5px solid var(--line)", borderRadius: 3,
    cursor: "pointer", background: "#fff",
  },
  anonHint: { display: "block", fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.45, marginTop: 3 },
  anonHandleWrap: { display: "block", marginTop: 12 },
  anonHandleLabel: { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 },
  anonHandleInput: {
    width: "100%", padding: "9px 10px", borderRadius: 3, border: "1.5px solid var(--line)",
    background: "#fff", color: "var(--text)", fontSize: 13.5,
  },
  anonHandleHelp: { display: "block", fontSize: 11.5, color: "var(--text-dim)", marginTop: 5, lineHeight: 1.4 },
  matchPanel: { width: 360, maxWidth: "100%", position: "sticky", top: 92 },
  dupBox: {
    border: "1.5px solid var(--signal)", borderRadius: 4, padding: 18,
    background: "#fff", marginBottom: 16,
  },
  dupLabel: { fontSize: 11, letterSpacing: 1, color: "var(--signal)", fontWeight: 600, marginBottom: 8 },
  dupText: { fontSize: 13, color: "var(--text)", lineHeight: 1.5, marginBottom: 12 },
  dupItem: {
    display: "block", padding: "10px 12px", border: "1.5px solid var(--line)",
    borderRadius: 3, marginBottom: 8, background: "var(--paper)",
  },
  dupTitle: { display: "block", fontWeight: 600, fontSize: 13.5, marginBottom: 5 },
  dupMeta: { display: "flex", gap: 12, alignItems: "center", fontSize: 12, color: "var(--text-dim)" },
  dupActions: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  matchIdle: { border: "1.5px dashed var(--line)", borderRadius: 4, padding: 24 },
  matchIdleLabel: { fontSize: 11, letterSpacing: 1, color: "var(--text-dim)", marginBottom: 10 },
  matchIdleText: { fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.55 },
  matchFoundLabel: { fontSize: 11, letterSpacing: 1, color: "var(--build)", fontWeight: 600, marginBottom: 8 },
  matchFoundText: { fontSize: 13, color: "var(--text-dim)", marginBottom: 14, lineHeight: 1.5 },
  noMatch: { border: "1.5px solid var(--spark)", borderRadius: 4, padding: 20, background: "#fff" },
  noMatchLabel: { fontSize: 11, letterSpacing: 1, color: "var(--ink)", fontWeight: 600, marginBottom: 8 },
  noMatchText: { fontSize: 13.5, color: "var(--text)", lineHeight: 1.55, marginBottom: 4 },
  adjacentNote: { fontSize: 12.5, color: "var(--text-dim)", margin: "14px 0 10px" },
};
