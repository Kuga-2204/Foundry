export default function NoSolutionBadge({ size = "sm" }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: size === "sm" ? 10.5 : 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        color: "var(--ink)",
        background: "var(--spark-soft)",
        border: "1.5px solid var(--spark)",
        borderRadius: 2,
        padding: size === "sm" ? "2px 7px" : "3px 9px",
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      No solution
    </span>
  );
}
