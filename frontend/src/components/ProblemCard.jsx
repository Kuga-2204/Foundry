import { Link } from "react-router-dom";
import VoteControl from "./VoteControl.jsx";

export default function ProblemCard({ problem, onVote }) {
  return (
    <div className="card" style={styles.card}>
      <VoteControl problem={problem} onVote={(type, reason) => onVote(problem.id, type, reason)} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.metaRow}>
          <span style={styles.category}>{problem.category}</span>
          <span className="mono" style={styles.date}>
            {new Date(problem.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>

        <Link to={`/problems/${problem.id}`} style={styles.title}>
          {problem.title}
        </Link>
        <p style={styles.desc}>{problem.description}</p>

        <div style={styles.footer}>
          <span style={styles.footerItem}>by {problem.author_name}</span>
          <span style={{ ...styles.footerItem, ...(problem.solutionCount > 0 ? styles.solved : {}) }}>
            {problem.solutionCount === 0
              ? "No builds yet"
              : `${problem.solutionCount} build${problem.solutionCount > 1 ? "s" : ""} submitted`}
          </span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    display: "flex",
    gap: 18,
    padding: 20,
    marginBottom: 14,
  },
  metaRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  category: {
    fontFamily: "var(--mono)",
    fontSize: 11.5,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "var(--ink)",
    background: "var(--paper-dim)",
    padding: "3px 8px",
    borderRadius: 2,
  },
  date: { fontSize: 11.5, color: "var(--text-dim)" },
  title: {
    fontFamily: "var(--display)",
    fontSize: 19,
    fontWeight: 600,
    display: "block",
    marginBottom: 6,
  },
  desc: {
    fontSize: 14.5,
    color: "var(--text-dim)",
    lineHeight: 1.5,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    marginBottom: 12,
  },
  footer: { display: "flex", gap: 16, fontSize: 12.5, color: "var(--text-dim)" },
  footerItem: { display: "inline-flex", alignItems: "center" },
  solved: { color: "var(--build)", fontWeight: 600 },
};
