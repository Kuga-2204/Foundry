import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import StartupCard from "../components/StartupCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const MAX_FILES = 4;
const MAX_FILE_MB = 30;

// Post a problem, with two live checks while the user types: does a startup
// already solve this, and is the same problem already listed? Duplicates are
// steered toward voting on the existing listing so demand stays concentrated.
export default function PostProblem() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", category: "General" });
  const [anonymous, setAnonymous] = useState(false);
  const [files, setFiles] = useState([]);
  const [matches, setMatches] = useState({ strong: [], adjacent: [] });
  const [similar, setSimilar] = useState([]);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories));
  }, []);

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
    setBusy(true);
    try {
      let payload;
      if (files.length > 0) {
        payload = new FormData();
        payload.append("title", form.title);
        payload.append("description", form.description);
        payload.append("category", form.category);
        payload.append("anonymous", anonymous ? "true" : "false");
        files.forEach((f) => payload.append("media", f));
      } else {
        payload = { ...form, anonymous };
      }
      const data = await api.createProblem(payload, token);
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
          <h1 style={styles.h1}>What's your problem?</h1>
          <p style={styles.sub}>
            Describe it and we'll check if a startup already solves it. If nothing exists
            yet, list it: you'll be notified the moment someone picks it up.
          </p>

          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={submit}>
            <div className="field">
              <label>Title</label>
              <input
                required
                placeholder='e.g. "No easy way to split rent fairly by usage"'
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="field">
              <label>Description</label>
              <textarea
                required
                rows={6}
                placeholder="What's the problem? Who has it? What have you already tried?"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                  Your name won't be shown anywhere on this problem. It stays linked to
                  your account privately, so you'll still get updates and can review fixes.
                </span>
              </span>
            </label>

            <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Posting…" : hasMatches ? "None of these fit, post my problem" : "Post problem"}
            </button>
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
