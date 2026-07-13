export function StarsDisplay({ value, count }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ letterSpacing: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ color: i <= Math.round(value) ? "var(--spark)" : "var(--line)" }}>
            ★
          </span>
        ))}
      </span>
      {typeof count === "number" && (
        <span className="mono" style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
          {value.toFixed(1)} ({count})
        </span>
      )}
    </span>
  );
}

export function StarsInput({ value, onChange }) {
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
          style={{
            background: "none",
            border: "none",
            fontSize: 26,
            color: i <= value ? "var(--spark)" : "var(--line)",
            padding: 2,
          }}
        >
          ★
        </button>
      ))}
    </span>
  );
}
