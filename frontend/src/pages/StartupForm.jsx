import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

// Create or edit a startup profile. The "problems we solve" statements are
// the matching corpus: they should read the way a frustrated user would
// describe the problem, not like marketing copy.
export default function StartupForm({ edit = false }) {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    description: "",
    website: "",
    category: "General",
  });
  const [statements, setStatements] = useState(["", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(edit);

  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories));
  }, []);

  useEffect(() => {
    if (!edit) return;
    api
      .getStartup(id, token)
      .then((data) => {
        const s = data.startup;
        if (!s.isOwner) {
          setError("Only the owner can edit this startup.");
          return;
        }
        setForm({
          name: s.name,
          tagline: s.tagline,
          description: s.description,
          website: s.website || "",
          category: s.category,
        });
        setStatements(s.statements.length ? s.statements.map((x) => x.statement) : [""]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [edit, id, token]);

  const setStatement = (i, value) => {
    setStatements((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = { ...form, statements: statements.filter((s) => s.trim()) };
      const data = edit
        ? await api.updateStartup(id, payload, token)
        : await api.createStartup(payload, token);
      navigate(`/startups/${data.startup.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="wrap" style={{ padding: 48 }}>Loading…</div>;

  return (
    <div className="wrap" style={styles.wrap}>
      <div className="card" style={styles.card}>
        <h1 style={styles.h1}>{edit ? "Edit startup profile" : "Add your startup"}</h1>
        <p style={styles.sub}>
          List what you solve in plain user language. When someone describes that exact
          problem, Solvyard matches them to you: leads, validation, and reviews from people
          who actually have the problem.
        </p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>Startup name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Tagline (one line, what you do)</label>
            <input
              required
              placeholder='e.g. "Splits rent and bills by actual usage"'
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Website (optional)</label>
            <input
              type="url"
              placeholder="https://…"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
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
            <label>Problems you solve (write them like a user would complain)</label>
            <p style={styles.statementHint}>
              These power the matching. Good: "splitting rent with roommates always causes
              fights". Bad: "next-gen fintech for shared living".
            </p>
            {statements.map((s, i) => (
              <div key={i} style={styles.statementRow}>
                <input
                  placeholder={`Problem statement ${i + 1}`}
                  value={s}
                  onChange={(e) => setStatement(i, e.target.value)}
                  style={{ flex: 1 }}
                />
                {statements.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label="Remove statement"
                    onClick={() => setStatements((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {statements.length < 10 && (
              <button
                type="button"
                className="btn btn-sm"
                style={{ alignSelf: "flex-start" }}
                onClick={() => setStatements((prev) => [...prev, ""])}
              >
                + Add another
              </button>
            )}
          </div>

          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Saving…" : edit ? "Save changes" : "List my startup"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", justifyContent: "center", padding: "48px 20px 80px" },
  card: { width: 620, padding: 36 },
  h1: { fontSize: 26, marginBottom: 8 },
  sub: { fontSize: 14, color: "var(--text-dim)", marginBottom: 24, lineHeight: 1.5 },
  statementHint: { fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 4 },
  statementRow: { display: "flex", gap: 8, alignItems: "center" },
};
