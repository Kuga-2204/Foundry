import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleButton from "../components/GoogleButton.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // New users land on the post page ("what's bugging you") by default, or
  // wherever they were headed before signing up (e.g. a saved draft).
  const next = params.get("next") || "/post";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      navigate(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div className="card" style={styles.card}>
        <h1 style={styles.h1}>Create an account</h1>
        <p style={styles.sub}>Post problems, vote, review, and list your startup, all with one account.</p>

        {error && <div className="error-banner">{error}</div>}

        <GoogleButton onDone={() => navigate(next)} onError={setError} />

        <form onSubmit={submit}>
          <div className="field">
            <label>Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account? <Link to="/login" style={{ fontWeight: 600 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", justifyContent: "center", padding: "64px 20px" },
  card: { width: 400, maxWidth: "100%", padding: 36 },
  h1: { fontSize: 26, marginBottom: 8 },
  sub: { fontSize: 14, color: "var(--text-dim)", marginBottom: 24 },
  footer: { fontSize: 14, color: "var(--text-dim)", marginTop: 18, textAlign: "center" },
};
