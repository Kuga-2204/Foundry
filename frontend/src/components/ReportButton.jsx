import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

// Lightweight flag control. Write-time moderation only catches profanity;
// this lets anyone surface anything else for a human to look at. Deliberately
// low-friction: pick a reason, submit, done.
const REASONS = ["Spam or ad", "Offensive or abusive", "Off-topic", "Something else"];

export default function ReportButton({ targetType, targetId }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const report = async (reason) => {
    setOpen(false);
    try {
      await api.report(targetType, targetId, reason);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch {
      // swallow: a failed report shouldn't disrupt the page
    }
  };

  if (done) return <span style={styles.done}>Flagged — thanks</span>;

  return (
    <span style={styles.wrap} ref={ref}>
      <button style={styles.trigger} onClick={() => setOpen((v) => !v)} title="Report this">
        Report
      </button>
      {open && (
        <div style={styles.menu} role="menu">
          {REASONS.map((r) => (
            <button key={r} style={styles.item} onClick={() => report(r)} role="menuitem">
              {r}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

const styles = {
  wrap: { position: "relative", display: "inline-block" },
  trigger: {
    background: "none", border: "none", padding: 0, cursor: "pointer",
    fontSize: 12, color: "var(--text-dim)", fontFamily: "inherit", textDecoration: "underline",
  },
  done: { fontSize: 12, color: "var(--build)" },
  menu: {
    position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 60, minWidth: 170,
    background: "#fff", border: "1.5px solid var(--line)", borderRadius: 4,
    boxShadow: "0 6px 20px rgba(16, 20, 37, 0.12)", padding: 5, display: "flex", flexDirection: "column",
  },
  item: {
    textAlign: "left", background: "none", border: "none", padding: "8px 11px",
    fontSize: 13, color: "var(--text)", cursor: "pointer", borderRadius: 3,
    fontFamily: "inherit", width: "100%",
  },
};
