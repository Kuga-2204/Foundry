import { useEffect, useRef, useState } from "react";

// Owner-only "..." menu for a post or comment: edit and delete in one place,
// instead of two separate always-visible buttons.
export default function PostMenu({ onEdit, onDelete, deleting }) {
  const [open, setOpen] = useState(false);
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

  return (
    <span style={styles.wrap} ref={ref}>
      <button
        aria-label="More options"
        onClick={() => setOpen((v) => !v)}
        style={styles.trigger}
      >
        ⋯
      </button>
      {open && (
        <div style={styles.menu} role="menu">
          <button
            style={styles.item}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </button>
          <button
            style={{ ...styles.item, color: "var(--signal)" }}
            role="menuitem"
            disabled={deleting}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
    </span>
  );
}

const styles = {
  wrap: { position: "relative", display: "inline-block" },
  trigger: {
    background: "none", border: "none", padding: "0 4px", cursor: "pointer",
    fontSize: 16, lineHeight: 1, color: "var(--text-dim)", fontFamily: "inherit",
  },
  menu: {
    position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 60, minWidth: 130,
    background: "#fff", border: "1.5px solid var(--line)", borderRadius: 4,
    boxShadow: "0 6px 20px rgba(16, 20, 37, 0.12)", padding: 5, display: "flex", flexDirection: "column",
  },
  item: {
    textAlign: "left", background: "none", border: "none", padding: "8px 11px",
    fontSize: 13, color: "var(--text)", cursor: "pointer", borderRadius: 3,
    fontFamily: "inherit", width: "100%",
  },
};
