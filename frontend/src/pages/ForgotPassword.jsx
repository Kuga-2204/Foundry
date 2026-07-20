import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div className="card" style={styles.card}>
        <h1 style={styles.h1}>Reset your password</h1>
        {sent ? (
          <>
            <p style={styles.sub}>
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
              Check your inbox and follow the link within the hour.
            </p>
            <Link to="/login" className="btn" style={{ width: "100%", textAlign: "center" }}>
              Back to log in
            </Link>
          </>
        ) : (
          <>
            <p style={styles.sub}>
              Enter your email and we'll send you a link to set a new password.
            </p>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={submit}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p style={styles.footer}>
              Remembered it? <Link to="/login" style={{ fontWeight: 600 }}>Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", justifyContent: "center", padding: "64px 20px" },
  card: { width: 400, maxWidth: "100%", padding: 36 },
  h1: { fontSize: 26, marginBottom: 8 },
  sub: { fontSize: 14, color: "var(--text-dim)", marginBottom: 24, lineHeight: 1.6 },
  footer: { fontSize: 14, color: "var(--text-dim)", marginTop: 18, textAlign: "center" },
};
