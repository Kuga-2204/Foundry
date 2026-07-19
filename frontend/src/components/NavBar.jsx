import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import NotificationsBell from "./NotificationsBell.jsx";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 760px)");

  return (
    <header style={styles.header}>
      <div
        className="wrap"
        style={{ ...styles.inner, ...(isMobile ? styles.innerMobile : null) }}
      >
        <Link to="/" style={styles.logo}>
          <img src="/solvyard-bulb.png" alt="" style={styles.logoMark} />
          <span>
            solv<span style={styles.logoAccent}>yard</span>
          </span>
        </Link>

        {/* On mobile the links wrap to their own full-width row below, which
            keeps the auth buttons from overflowing off the screen. */}
        <nav style={{ ...styles.nav, ...(isMobile ? styles.navMobile : null) }}>
          <Link to="/problems" style={styles.link}>Problems</Link>
          <Link to="/startups" style={styles.link}>Startups</Link>
          {user && <Link to="/post" style={styles.link}>Post</Link>}
          {user && <Link to="/dashboard" style={styles.link}>Dashboard</Link>}
        </nav>

        <div style={styles.right}>
          {user ? (
            <>
              <NotificationsBell />
              {!isMobile && (
                <span style={styles.hello} className="mono">hi, {user.name.split(" ")[0]}</span>
              )}
              <button
                className="btn btn-sm"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-sm">Log in</Link>
              <Link to="/register" className="btn btn-sm btn-primary">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    borderBottom: "1.5px solid var(--line)",
    background: "var(--paper)",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  inner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 68,
    gap: 24,
  },
  innerMobile: {
    flexWrap: "wrap",
    height: "auto",
    paddingTop: 12,
    paddingBottom: 12,
    rowGap: 10,
    columnGap: 12,
  },
  navMobile: {
    order: 3,
    width: "100%",
    marginLeft: 0,
    gap: 18,
    overflowX: "auto",
    flex: "none",
  },
  logo: {
    fontFamily: "var(--display)",
    fontWeight: 700,
    fontSize: 21,
    letterSpacing: "-0.02em",
    flexShrink: 0,
    color: "var(--ink)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  logoMark: { height: 30, width: "auto", display: "block" },
  logoAccent: { color: "var(--spark)" },
  nav: { display: "flex", gap: 22, flex: 1, marginLeft: 12 },
  link: { fontSize: 14.5, fontWeight: 500, color: "var(--text-dim)" },
  right: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 },
  hello: { fontSize: 13, color: "var(--text-dim)" },
};
