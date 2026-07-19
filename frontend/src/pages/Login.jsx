import { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleButton from "../components/GoogleButton.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const dest = params.get("next") || location.state?.from || "/problems";
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate(dest);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div className="card" style={styles.card}>
        <h1 style={styles.h1}>Log in</h1>
        <p style={styles.sub}>Vote on problems, submit builds, and leave reviews.</p>

        {error && <div className="error-banner">{error}</div>}

        <GoogleButton onDone={() => navigate(dest)} onError={setError} />

        <form onSubmit={submit}>
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
            <label style={styles.pwLabel}>
              Password
              <Link to="/forgot-password" style={styles.forgot}>Forgot?</Link>
            </label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p style={styles.footer}>
          New here? <Link to="/register" style={{ fontWeight: 600 }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", justifyContent: "center", padding: "64px 20px" },
  card: { width: 400, padding: 36 },
  h1: { fontSize: 26, marginBottom: 8 },
  sub: { fontSize: 14, color: "var(--text-dim)", marginBottom: 24 },
  footer: { fontSize: 14, color: "var(--text-dim)", marginTop: 18, textAlign: "center" },
  pwLabel: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  forgot: { fontSize: 12.5, fontWeight: 500, color: "var(--text-dim)" },
};
