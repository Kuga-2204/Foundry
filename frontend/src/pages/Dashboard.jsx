import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { StarsDisplay } from "../components/Stars.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

// Startup dashboard: the lead feed. Problems that match what your startup
// solves (with the user's raw phrasing), plus adjacent problems in your
// space as roadmap signal.
export default function Dashboard() {
  const { token } = useAuth();
  const [startups, setStartups] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [leads, setLeads] = useState({ strong: [], adjacent: [] });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .myStartups(token)
      .then((d) => {
        setStartups(d.startups);
        if (d.startups.length > 0) setActiveId(d.startups[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const loadLeads = useCallback(() => {
    if (!activeId) return;
    setLeadsLoading(true);
    setStats(null);
    Promise.all([api.startupLeads(activeId, token), api.startupStats(activeId, token)])
      .then(([leadData, statData]) => {
        setLeads(leadData);
        setStats(statData.stats);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLeadsLoading(false));
  }, [activeId, token]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  if (loading) return <div className="wrap" style={{ padding: 48 }}>Loading…</div>;

  if (startups.length === 0) {
    return (
      <div className="wrap" style={styles.wrap}>
        <div style={styles.emptyState}>
          <h1 style={{ fontSize: 24, marginBottom: 10 }}>No startup on your account yet</h1>
          <p style={{ color: "var(--text-dim)", fontSize: 14.5, marginBottom: 22, lineHeight: 1.6 }}>
            The dashboard shows you every problem posted on Solvyard that matches what your
            startup solves: real people describing the exact pain, in their own words.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/startups/new" className="btn btn-primary">Add your startup</Link>
            <Link to="/startups" className="btn">Claim an existing profile</Link>
          </div>
        </div>
      </div>
    );
  }

  const active = startups.find((s) => s.id === activeId);

  return (
    <div className="wrap" style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Startup dashboard</h1>
          <p style={styles.sub}>Problems on Solvyard that match what you solve.</p>
        </div>
        {startups.length > 1 && (
          <select
            value={activeId || ""}
            onChange={(e) => setActiveId(Number(e.target.value))}
            style={styles.select}
          >
            {startups.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {active && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 30 }}>
          <div className="card" style={{ ...styles.summaryCard, marginBottom: 0 }}>
            <div style={{ minWidth: 0 }}>
              <Link to={`/startups/${active.id}`} style={styles.summaryName}>{active.name}</Link>
              <p style={styles.summaryTagline}>{active.tagline}</p>
            </div>
            <div style={styles.summaryStats}>
              <Stat label="Solutions" value={active.solutionCount} />
              <Stat label="Commitments" value={active.commitmentCount} />
            </div>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", gap: 20 }}>
            {stats ? (
              <>
                <div style={{ flex: 1 }}>
                  <p style={styles.statLabel}>Search appearances</p>
                  <p style={{ fontSize: 22, fontWeight: 700, margin: "4px 0" }}>{stats.searchAppearances.total}</p>
                  <p style={{ fontSize: 11, color: "var(--build)", fontWeight: 600 }}>
                    +{stats.searchAppearances.week} this week
                  </p>
                </div>
                <div style={{ width: 1.5, background: "var(--line)" }} />
                <div style={{ flex: 1 }}>
                  <p style={styles.statLabel}>Profile views</p>
                  <p style={{ fontSize: 22, fontWeight: 700, margin: "4px 0" }}>{stats.profileViews.total}</p>
                  <p style={{ fontSize: 11, color: "var(--build)", fontWeight: 600 }}>
                    +{stats.profileViews.week} this week
                  </p>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-dim)" }}>Loading stats…</p>
            )}
          </div>
        </div>
      )}

      <h2 style={styles.h2}>
        Matched problems{" "}
        <span className="mono" style={styles.countNote}>({leads.strong.length})</span>
      </h2>
      <p style={styles.hint}>
        People describing a problem your statements cover. Reply with a solution, or commit
        to building a fix; everyone following the problem gets notified.
      </p>

      {leadsLoading ? (
        <p style={styles.emptyNote}>Loading…</p>
      ) : leads.strong.length === 0 ? (
        <p style={styles.emptyNote}>
          No matches yet. Add more "problems we solve" statements to your profile; the more
          they sound like real complaints, the better the matching.
        </p>
      ) : (
        leads.strong.map((p) => <LeadCard key={p.id} problem={p} />)
      )}

      {leads.adjacent.length > 0 && (
        <>
          <h2 style={styles.h2}>
            Adjacent problems{" "}
            <span className="mono" style={styles.countNote}>({leads.adjacent.length})</span>
          </h2>
          <p style={styles.hint}>
            Not an exact match, but in your space. Free roadmap signal: what people near
            your product are struggling with.
          </p>
          {leads.adjacent.map((p) => <LeadCard key={p.id} problem={p} />)}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <span className="mono" style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

function LeadCard({ problem }) {
  return (
    <div className="card" style={styles.lead}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.leadTop}>
          <Link to={`/problems/${problem.id}`} style={styles.leadTitle}>{problem.title}</Link>
          <StatusBadge status={problem.status} />
        </div>
        <p style={styles.leadDesc}>{problem.description}</p>
        <div style={styles.leadFooter}>
          <span>by {problem.author_name}</span>
          <span className="mono">score {problem.score}</span>
          <span className="mono">{problem.followerCount} following</span>
          {problem.matchedTerms?.length > 0 && (
            <span style={{ fontStyle: "italic" }}>
              matched: {problem.matchedTerms.slice(0, 4).join(", ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: "40px 28px 80px", maxWidth: 860 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 16, flexWrap: "wrap" },
  h1: { fontSize: 28, marginBottom: 6 },
  sub: { fontSize: 14.5, color: "var(--text-dim)" },
  select: {
    padding: "10px 13px", borderRadius: 3, border: "1.5px solid var(--line)",
    fontSize: 14, background: "#fff",
  },
  emptyState: { padding: "80px 24px", textAlign: "center", border: "1.5px dashed var(--line)", borderRadius: 4, maxWidth: 560, margin: "40px auto" },
  summaryCard: { padding: 22, marginBottom: 30, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" },
  summaryName: { fontFamily: "var(--display)", fontSize: 19, fontWeight: 700 },
  summaryTagline: { fontSize: 13, color: "var(--text-dim)", marginTop: 3 },
  summaryStats: { display: "flex", gap: 26, flexWrap: "wrap" },
  stat: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3 },
  statValue: { fontSize: 20, fontWeight: 600 },
  statLabel: { fontSize: 11.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 },
  h2: { fontSize: 19, marginTop: 26, marginBottom: 8 },
  countNote: { color: "var(--text-dim)", fontSize: 14 },
  hint: { fontSize: 13, color: "var(--text-dim)", marginBottom: 14, lineHeight: 1.5 },
  emptyNote: { fontSize: 13.5, color: "var(--text-dim)", padding: "18px 0" },
  lead: { padding: 18, marginBottom: 12, display: "flex", gap: 14 },
  leadTop: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 },
  leadTitle: { fontFamily: "var(--display)", fontSize: 16.5, fontWeight: 600 },
  leadDesc: {
    fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 10,
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
  },
  leadFooter: { display: "flex", gap: 16, fontSize: 12, color: "var(--text-dim)", flexWrap: "wrap" },
};
