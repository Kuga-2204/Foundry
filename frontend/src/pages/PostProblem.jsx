import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function PostProblem() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", category: "General" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories));
  }, []);

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

  return (
    <div className="wrap" style={styles.wrap}>
      <div className="card" style={styles.card}>
        <h1 style={styles.h1}>Post a problem</h1>
        <p style={styles.sub}>
          Describe something in your daily life you can't solve yourself. Be specific — the more
          concrete the problem, the easier it is for a builder to say "I can fix that."
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
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Posting…" : "Post problem"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", justifyContent: "center", padding: "48px 20px 80px" },
  card: { width: 560, padding: 36 },
  h1: { fontSize: 26, marginBottom: 8 },
  sub: { fontSize: 14, color: "var(--text-dim)", marginBottom: 24, lineHeight: 1.5 },
};
