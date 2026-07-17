import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import StartupCard from "../components/StartupCard.jsx";

// Post a problem, with live matching: while the user types, Foundry checks
// whether a startup already solves it. If yes, they get their answer right
// here. If no, listing the problem becomes the demand signal.
export default function PostProblem() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", category: "General" });
  const [matches, setMatches] = useState({ strong: [], adjacent: [] });
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories));
  }, []);

  const text = `${form.title} ${form.description}`.trim();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (text.length < 12) {
      setMatches({ strong: [], adjacent: [] });
      setChecked(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      api
        .matchText(text)
        .then((d) => {
          setMatches(d);
          setChecked(true);
        })
        .catch(() => {});
    }, 450);
    return () => clearTimeout(debounceRef.current);
  }, [text]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api.createProblem(form, token);
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

            <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Posting…" : hasMatches ? "None of these fit, post my problem" : "Post problem"}
            </button>
          </form>
        </div>

        <div style={styles.matchPanel}>
          {!checked ? (
            <div style={styles.matchIdle}>
              <p className="mono" style={styles.matchIdleLabel}>LIVE CHECK</p>
              <p style={styles.matchIdleText}>
                Start typing and we'll search the startup directory for someone who already
                solves this.
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
  matchPanel: { width: 360, maxWidth: "100%", position: "sticky", top: 92 },
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
