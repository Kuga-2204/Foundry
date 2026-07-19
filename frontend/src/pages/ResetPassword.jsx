import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div className="card" style={styles.card}>
        <h1 style={styles.h1}>Set a new password</h1>

        {!token ? (
          <p style={styles.sub}>
            This link is missing its token. Request a fresh one from{" "}
            <Link to="/forgot-password" style={{ fontWeight: 600 }}>forgot password</Link>.
          </p>
        ) : done ? (
          <p style={styles.sub}>Password updated. Taking you to log in…</p>
        ) : (
          <>
            <p style={styles.sub}>Choose a new password for your account.</p>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={submit}>
              <div className="field">
                <label>New password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
                {busy ? "Saving…" : "Reset password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", justifyContent: "center", padding: "64px 20px" },
  card: { width: 400, padding: 36 },
  h1: { fontSize: 26, marginBottom: 8 },
  sub: { fontSize: 14, color: "var(--text-dim)", marginBottom: 24, lineHeight: 1.6 },
};
