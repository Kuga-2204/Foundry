import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// First-run nudge. New users land on the problems board after signing up; a
// blank-looking board reads as dead, so this points them straight at the two
// actions that matter — see what's active, or post their own frustration.
// Dismissed once per user, remembered in localStorage.
export default function WelcomeBanner() {
  const { user } = useAuth();
  const [closed, setClosed] = useState(false);

  // user is null on the first render while auth loads, so we can't read the
  // dismissal flag until it resolves — reading it here (not in useState init)
  // means the banner re-evaluates correctly once the user arrives.
  if (!user || closed) return null;
  const key = `sy_welcome_dismissed_${user.id}`;
  if (localStorage.getItem(key) === "1") return null;

  const close = () => {
    localStorage.setItem(key, "1");
    setClosed(true);
  };

  return (
    <div style={styles.banner}>
      <button style={styles.close} onClick={close} aria-label="Dismiss">×</button>
      <p style={styles.title}>Welcome to Solvyard, {user.name.split(" ")[0]} 👋</p>
      <p style={styles.body}>
        Two ways to start: browse what people are struggling with right now, or describe a
        problem of your own. Every vote is a person waiting for a fix, so the more real your
        complaint sounds, the better the match.
      </p>
      <div style={styles.actions}>
        <Link to="/problems?sort=trending" className="btn btn-sm" onClick={close}>
          See what's trending
        </Link>
        <Link to="/post" className="btn btn-sm btn-primary" onClick={close}>
          Describe your problem →
        </Link>
      </div>
    </div>
  );
}

const styles = {
  banner: {
    position: "relative",
    border: "1.5px solid var(--line)",
    borderLeft: "4px solid var(--spark)",
    borderRadius: 4,
    background: "var(--paper-dim)",
    padding: "18px 22px",
    marginBottom: 24,
  },
  close: {
    position: "absolute", top: 10, right: 14, background: "none", border: "none",
    fontSize: 20, lineHeight: 1, color: "var(--text-dim)", cursor: "pointer",
  },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  body: { fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.55, marginBottom: 14, maxWidth: 620 },
  actions: { display: "flex", gap: 10, flexWrap: "wrap" },
};
