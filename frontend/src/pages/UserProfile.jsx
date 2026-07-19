import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatDate } from "../utils.js";

export default function UserProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    api.userProfile(id).then(setData).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="wrap" style={{ padding: 48 }}><div className="error-banner">{error}</div></div>;
  if (!data) return <div className="wrap" style={{ padding: 48 }}>Loading…</div>;

  const { user, stats, problems, solutions, startups } = data;

  return (
    <div className="wrap" style={styles.wrap}>
      <div className="card" style={styles.header}>
        <div style={styles.avatar}>{user.name.charAt(0).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <h1 style={styles.name}>{user.name}</h1>
          <p style={styles.joined}>Joined {formatDate(user.created_at)}</p>
          {user.bio && <p style={styles.bio}>{user.bio}</p>}
          <div style={styles.stats}>
            <Stat n={stats.problemCount} label="problems" />
            <Stat n={stats.solutionCount} label="solutions" />
            <Stat n={stats.startupCount} label="startups" />
          </div>
        </div>
      </div>

      {startups.length > 0 && (
        <Section title="Startups">
          {startups.map((s) => (
            <Link key={s.id} to={`/startups/${s.id}`} className="card" style={styles.row}>
              <span style={styles.rowTitle}>{s.name}</span>
              <span style={styles.rowMeta}>{s.tagline}</span>
            </Link>
          ))}
        </Section>
      )}

      <Section title="Problems posted">
        {problems.length === 0 ? (
          <p style={styles.empty}>No public problems yet.</p>
        ) : (
          problems.map((p) => (
            <Link key={p.id} to={`/problems/${p.id}`} className="card" style={styles.row}>
              <div style={styles.rowTop}>
                <span style={styles.rowTitle}>{p.title}</span>
                <StatusBadge status={p.status} />
              </div>
              <span style={styles.rowMeta}>
                {p.category} · score {p.score} · {formatDate(p.created_at)}
              </span>
            </Link>
          ))
        )}
      </Section>

      {solutions.length > 0 && (
        <Section title="Solutions contributed">
          {solutions.map((s) => (
            <Link key={s.id} to={`/problems/${s.problem_id}`} className="card" style={styles.row}>
              <span style={styles.rowTitle}>{s.title}</span>
              <span style={styles.rowMeta}>
                {s.startup_name ? `as ${s.startup_name} · ` : ""}on "{s.problem_title}"
              </span>
            </Link>
          ))}
        </Section>
      )}
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div style={styles.stat}>
      <span className="mono" style={styles.statN}>{n}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <>
      <h2 style={styles.h2}>{title}</h2>
      <div style={styles.list}>{children}</div>
    </>
  );
}

const styles = {
  wrap: { padding: "40px 28px 80px", maxWidth: 780 },
  header: { display: "flex", gap: 20, padding: 26, marginBottom: 30, alignItems: "center" },
  avatar: {
    width: 64, height: 64, borderRadius: "50%", background: "var(--ink)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
    fontFamily: "var(--display)", fontWeight: 700, flexShrink: 0,
  },
  name: { fontSize: 24, fontWeight: 700 },
  joined: { fontSize: 13, color: "var(--text-dim)", marginTop: 2 },
  bio: { fontSize: 14, color: "var(--text)", marginTop: 8, lineHeight: 1.5 },
  stats: { display: "flex", gap: 24, marginTop: 14 },
  stat: { display: "flex", flexDirection: "column" },
  statN: { fontSize: 18, fontWeight: 700 },
  statLabel: { fontSize: 11.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 },
  h2: { fontSize: 18, marginTop: 28, marginBottom: 12 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  row: { padding: 16, display: "block" },
  rowTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 },
  rowTitle: { fontWeight: 600, fontSize: 15, display: "block", marginBottom: 3 },
  rowMeta: { fontSize: 12.5, color: "var(--text-dim)" },
  empty: { fontSize: 13.5, color: "var(--text-dim)", padding: "8px 0" },
};
