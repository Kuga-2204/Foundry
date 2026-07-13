import { STATUS_LABELS, STATUS_COLORS } from "../utils.js";

export default function StatusBadge({ status, size = "sm" }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || "var(--text-dim)";
  return (
    <span
      className="mono"
      style={{
        fontSize: size === "sm" ? 10.5 : 12,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        color: "var(--ink)",
        background: "transparent",
        border: `1.5px solid ${color}`,
        borderRadius: 2,
        padding: size === "sm" ? "2px 7px" : "3px 9px",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}
