import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";

export default function NotificationsBell() {
  const { token } = useAuth();
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const load = useCallback(() => {
    api
      .notifications(token)
      .then((d) => {
        setItems(d.notifications);
        setUnread(d.unread);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      api.markNotificationsRead(token).then(() => setUnread(0)).catch(() => {});
    }
  };

  return (
    <div style={{ position: "relative" }} ref={boxRef}>
      <button aria-label="Notifications" onClick={toggle} style={styles.bell}>
        <span style={{ fontSize: 18 }}>🔔</span>
        {unread > 0 && (
          <span className="mono" style={styles.count}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="card" style={{ ...styles.dropdown, ...(isMobile ? styles.dropdownMobile : null) }}>
          <div style={styles.dropdownHeader}>
            <strong style={{ fontSize: 13.5 }}>Notifications</strong>
          </div>
          {items.length === 0 ? (
            <p style={styles.empty}>Nothing yet. Follow or vote on problems to get updates here.</p>
          ) : (
            items.slice(0, 12).map((n) => (
              <Link key={n.id} to={n.link || "#"} onClick={() => setOpen(false)} style={styles.item}>
                <span style={{ ...styles.dot, opacity: n.read ? 0 : 1 }} />
                <span style={styles.message}>{n.message}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  bell: {
    position: "relative",
    width: 36,
    height: 36,
    borderRadius: 3,
    border: "1.5px solid var(--line)",
    background: "#fff",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--ink)",
  },
  count: {
    position: "absolute",
    top: -6,
    right: -6,
    background: "var(--signal)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 8,
    padding: "1px 5px",
    lineHeight: 1.4,
  },
  dropdown: {
    position: "absolute",
    right: 0,
    top: 44,
    width: 340,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: 420,
    overflowY: "auto",
    zIndex: 80,
    boxShadow: "0 8px 24px rgba(15,22,38,0.14)",
  },
  // On phones, anchor to the viewport (fixed) with equal side margins so the
  // panel can never spill off either edge regardless of the bell's position.
  dropdownMobile: {
    position: "fixed",
    top: 60,
    left: 12,
    right: 12,
    width: "auto",
    maxWidth: "none",
    maxHeight: "70vh",
  },
  dropdownHeader: { padding: "12px 16px", borderBottom: "1px solid var(--line)" },
  empty: { padding: 16, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 },
  item: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: "11px 16px",
    borderBottom: "1px solid var(--line)",
  },
  dot: { width: 7, height: 7, borderRadius: "50%", background: "var(--spark)", marginTop: 5, flexShrink: 0 },
  message: { fontSize: 13, lineHeight: 1.45, color: "var(--text)" },
};
