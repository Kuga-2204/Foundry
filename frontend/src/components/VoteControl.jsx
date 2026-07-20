import { useAuth } from "../context/AuthContext.jsx";

export default function VoteControl({ problem, onVote, size = "md", disabled = false }) {
  const { user } = useAuth();
  const dim = size === "lg" ? 40 : 30;
  const fontSize = size === "lg" ? 26 : 22;

  const cast = (type) => {
    if (!user) {
      onVote?.(null, "auth-required");
      return;
    }
    onVote?.(type);
  };

  const up = problem.myVote === 1;
  const down = problem.myVote === -1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <button
        aria-label="Upvote: I have this problem too"
        aria-pressed={up}
        title="I have this problem too"
        disabled={disabled}
        aria-busy={disabled}
        onClick={() => cast(1)}
        style={{
          ...btnStyle(dim),
          background: up ? "var(--build)" : "#fff",
          color: up ? "#fff" : "var(--text-dim)",
          borderColor: up ? "var(--build)" : "var(--line)",
        }}
      >
        ▲
      </button>
      <span className="mono" style={{ fontSize: fontSize - 8, fontWeight: 600, minWidth: 24, textAlign: "center" }}>
        {problem.upvotes ?? problem.score ?? 0}
      </span>
      <button
        aria-label="Downvote: not relevant to me"
        aria-pressed={down}
        title="Not relevant to me"
        disabled={disabled}
        aria-busy={disabled}
        onClick={() => cast(-1)}
        style={{
          ...btnStyle(dim),
          background: down ? "var(--signal)" : "#fff",
          color: down ? "#fff" : "var(--text-dim)",
          borderColor: down ? "var(--signal)" : "var(--line)",
        }}
      >
        ▼
      </button>
    </div>
  );
}

function btnStyle(dim) {
  return {
    width: dim,
    height: dim,
    borderRadius: 3,
    border: "1.5px solid var(--line)",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    lineHeight: 1,
  };
}
