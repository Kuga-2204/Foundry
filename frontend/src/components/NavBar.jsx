import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header style={styles.header}>
      <div className="wrap" style={styles.inner}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoMark}>◆</span> Foundry
        </Link>

        <nav style={styles.nav}>
          <Link to="/problems" style={styles.link}>Browse problems</Link>
          {user && <Link to="/post" style={styles.link}>Post a problem</Link>}
          {user && <Link to="/problems?mine=true" style={styles.link}>My problems</Link>}
        </nav>

        <div style={styles.right}>
          {user ? (
            <>
              <span style={styles.hello} className="mono">hi, {user.name.split(" ")[0]}</span>
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
  logo: {
    fontFamily: "var(--display)",
    fontWeight: 700,
    fontSize: 20,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  logoMark: { color: "var(--spark)", fontSize: 14 },
  nav: { display: "flex", gap: 22, flex: 1, marginLeft: 12 },
  link: { fontSize: 14.5, fontWeight: 500, color: "var(--text-dim)" },
  right: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 },
  hello: { fontSize: 13, color: "var(--text-dim)" },
};
