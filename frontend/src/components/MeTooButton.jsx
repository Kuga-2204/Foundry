import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

// One-click "me too": the lowest-friction way to back a problem. Maps to an
// upvote, toggles off on a second click, and — for logged-out visitors —
// turns the intent into a signup (returning them here afterward) instead of a
// dead-end error. Lowers the bar from "write a comment" to a single tap.
export default function MeTooButton({ problem, onVoted }) {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const active = problem.myVote === 1;

  const click = async () => {
    if (!user) {
      navigate(`/register?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      const data = await api.vote(problem.id, 1, token);
      onVoted?.(data.problem);
    } catch {
      /* non-critical */
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={click}
      disabled={busy}
      aria-pressed={active}
      style={{ ...styles.btn, ...(active ? styles.active : styles.idle) }}
    >
      <span style={styles.icon}>{active ? "✓" : "+"}</span>
      {active ? "I have this too" : "Me too"}
      <span style={styles.count}>{problem.upvotes ?? problem.score}</span>
    </button>
  );
}

const styles = {
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 16px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.12s, border-color 0.12s",
  },
  idle: { background: "#fff", border: "1.5px solid var(--build)", color: "var(--build)" },
  active: { background: "var(--build)", border: "1.5px solid var(--build)", color: "#fff" },
  icon: { fontSize: 15, lineHeight: 1 },
  count: {
    fontFamily: "var(--mono)",
    fontSize: 12.5,
    fontWeight: 700,
    padding: "1px 7px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.12)",
  },
};
