import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import NoSolutionBadge from "../components/NoSolutionBadge.jsx";
import { formatDate } from "../utils.js";

export default function Dashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("problems");
  const [problemData, setProblemData] = useState({ postedProblems: [], followedProblems: [], updates: [] });
  const [startups, setStartups] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [leads, setLeads] = useState({ strong: [], adjacent: [] });
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([api.problemDashboard(token), api.myStartups(token), api.categories(), api.userInterests(token)])
      .then(([dashboard, startupData, categoryData, interestData]) => {
        setProblemData(dashboard);
        setStartups(startupData.startups);
        setCategories(categoryData.categories);
        setInterests(interestData.interests || []);
        if (startupData.startups.length > 0) setActiveId(startupData.startups[0].id);
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

  if (loading) return <div className="wrap" style={{ padding: 48 }}>Loading...</div>;

  const active = startups.find((s) => s.id === activeId);

  return (
    <div className="wrap" style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Dashboard</h1>
          <p style={styles.sub}>
            Track your problems, followed problems, and startup leads from one place.
          </p>
        </div>
        <div style={styles.tabs} role="tablist" aria-label="Dashboard sections">
          <button
            style={{ ...styles.tab, ...(activeTab === "problems" ? styles.activeTab : {}) }}
            onClick={() => setActiveTab("problems")}
            role="tab"
            aria-selected={activeTab === "problems"}
          >
            Problems
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "startups" ? styles.activeTab : {}) }}
            onClick={() => setActiveTab("startups")}
            role="tab"
            aria-selected={activeTab === "startups"}
          >
            Startups
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {activeTab === "problems" ? (
        <ProblemDashboard
          data={problemData}
          categories={categories}
          interests={interests}
          token={token}
          onInterestsChanged={setInterests}
        />
      ) : (
        <StartupDashboard
          startups={startups}
          active={active}
          activeId={activeId}
          setActiveId={setActiveId}
          leads={leads}
          stats={stats}
          leadsLoading={leadsLoading}
        />
      )}
    </div>
  );
}

function ProblemDashboard({ data, categories, interests, token, onInterestsChanged }) {
  const posted = data.postedProblems || [];
  const followed = data.followedProblems || [];
  const updates = data.updates || [];

  return (
    <>
      <div style={styles.summaryGrid}>
        <SummaryCard label="Posted problems" value={posted.length} helper="Problems you created" />
        <SummaryCard label="Following" value={followed.length} helper="Problems you are tracking" />
        <SummaryCard label="Recent updates" value={updates.length} helper="Solutions, comments, and commitments" />
      </div>

      <InterestEditor
        categories={categories}
        interests={interests}
        token={token}
        onSaved={onInterestsChanged}
      />

      <div style={styles.twoCol}>
        <section>
          <SectionTitle title="Your posted problems" count={posted.length} />
          {posted.length === 0 ? (
            <EmptyNote>
              You have not posted a problem yet. <Link to="/post" style={styles.inlineLink}>Post one</Link> when a pain point is worth validating.
            </EmptyNote>
          ) : (
            posted.slice(0, 5).map((problem) => <ProblemMiniCard key={problem.id} problem={problem} />)
          )}
        </section>

        <section>
          <SectionTitle title="Problems you follow" count={followed.length} />
          {followed.length === 0 ? (
            <EmptyNote>Follow a problem to watch for solutions, comments, and startup commitments.</EmptyNote>
          ) : (
            followed.slice(0, 5).map((problem) => <ProblemMiniCard key={problem.id} problem={problem} />)
          )}
        </section>
      </div>

      <section style={{ marginTop: 28 }}>
        <SectionTitle title="Recent updates" count={updates.length} />
        {updates.length === 0 ? (
          <EmptyNote>No recent movement yet on your posted or followed problems.</EmptyNote>
        ) : (
          <div style={styles.activityList}>
            {updates.map((update) => <ActivityItem key={`${update.type}-${update.id}`} update={update} />)}
          </div>
        )}
      </section>
    </>
  );
}

function StartupDashboard({ startups, active, activeId, setActiveId, leads, stats, leadsLoading }) {
  if (startups.length === 0) {
    return (
      <div style={styles.emptyState}>
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>No startup on your account yet</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 14.5, marginBottom: 22, lineHeight: 1.6 }}>
          Add or claim a startup to see problems on Solvyard that match what it solves.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/startups/new" className="btn btn-primary">Add your startup</Link>
          <Link to="/startups" className="btn">Claim an existing profile</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.h2}>Startup dashboard</h2>
          <p style={styles.hint}>Problems on Solvyard that match what you solve.</p>
        </div>
        {startups.length > 1 && (
          <select value={activeId || ""} onChange={(e) => setActiveId(Number(e.target.value))} style={styles.select}>
            {startups.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {active && (
        <div style={styles.summaryGrid}>
          <div className="card" style={styles.summaryPanel}>
            <Link to={`/startups/${active.id}`} style={styles.summaryName}>{active.name}</Link>
            <p style={styles.summaryTagline}>{active.tagline}</p>
            <div style={styles.summaryStats}>
              <Stat label="Solutions" value={active.solutionCount} />
              <Stat label="Commitments" value={active.commitmentCount} />
            </div>
          </div>

          <div className="card" style={styles.summaryPanel}>
            {stats ? (
              <div style={styles.reachGrid}>
                <Stat label="Search appearances" value={stats.searchAppearances.total} helper={`+${stats.searchAppearances.week} this week`} />
                <Stat label="Profile views" value={stats.profileViews.total} helper={`+${stats.profileViews.week} this week`} />
              </div>
            ) : (
              <p style={styles.emptyNote}>Loading stats...</p>
            )}
          </div>
        </div>
      )}

      <SectionTitle title="Matched problems" count={leads.strong.length} />
      <p style={styles.hint}>
        Reply with a solution or commit to building a fix; everyone following the problem gets notified.
      </p>
      {leadsLoading ? (
        <p style={styles.emptyNote}>Loading...</p>
      ) : leads.strong.length === 0 ? (
        <p style={styles.emptyNote}>
          No matches yet. Add more "problems we solve" statements to your profile.
        </p>
      ) : (
        leads.strong.map((p) => <LeadCard key={p.id} problem={p} />)
      )}

      {leads.adjacent.length > 0 && (
        <>
          <SectionTitle title="Adjacent problems" count={leads.adjacent.length} />
          <p style={styles.hint}>Not an exact match, but useful roadmap signal from nearby pain points.</p>
          {leads.adjacent.map((p) => <LeadCard key={p.id} problem={p} />)}
        </>
      )}
    </>
  );
}

function SummaryCard({ label, value, helper }) {
  return (
    <div className="card" style={styles.metricCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.metricValue}>{value}</p>
      <p style={styles.metricHelper}>{helper}</p>
    </div>
  );
}

function SectionTitle({ title, count }) {
  return (
    <h2 style={styles.h2}>
      {title} <span className="mono" style={styles.countNote}>({count})</span>
    </h2>
  );
}

function ProblemMiniCard({ problem }) {
  return (
    <div className="card" style={styles.problemMini}>
      <div style={styles.problemMiniTop}>
        <Link to={`/problems/${problem.id}`} style={styles.problemTitle}>{problem.title}</Link>
        <span style={styles.badgeRow}>
          <StatusBadge status={problem.status} />
          {problem.solutionCount === 0 && <NoSolutionBadge />}
        </span>
      </div>
      <p style={styles.problemDesc}>{problem.description}</p>
      <div style={styles.problemMeta}>
        <span>{problem.followerCount} following</span>
        <span>{problem.solutionCount} solution{problem.solutionCount === 1 ? "" : "s"}</span>
        <span>{problem.commentCount} comment{problem.commentCount === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}

function ActivityItem({ update }) {
  const label = activityLabel(update);
  return (
    <Link to={`/problems/${update.problem_id}`} className="card" style={styles.activityItem}>
      <div style={{ minWidth: 0 }}>
        <div style={styles.activityTop}>
          <span className="mono" style={styles.activityType}>{label}</span>
          <span className="mono" style={styles.activityDate}>
            {formatDate(update.created_at, { month: "short", day: "numeric" })}
          </span>
        </div>
        <p style={styles.activityTitle}>{activityHeadline(update)}</p>
        <p style={styles.activityProblem}>on {update.problem_title}</p>
        {update.body && <p style={styles.activityBody}>{update.body}</p>}
      </div>
    </Link>
  );
}

function InterestEditor({ categories, interests, token, onSaved }) {
  const [selected, setSelected] = useState(() => new Set(interests));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSelected(new Set(interests));
  }, [interests]);

  const toggle = (category) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
    setMessage("");
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const data = await api.updateUserInterests([...selected], token);
      onSaved(data.interests || []);
      setMessage("Saved");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card" style={styles.interestsCard}>
      <div style={styles.interestsHead}>
        <div>
          <h2 style={styles.interestsTitle}>Interests</h2>
          <p style={styles.hint}>Choose categories to shape your Discover Problems feed.</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save interests"}
        </button>
      </div>
      <div style={styles.interestGrid}>
        {categories.map((category) => (
          <label key={category} style={styles.interestOption}>
            <input
              type="checkbox"
              checked={selected.has(category)}
              onChange={() => toggle(category)}
            />
            {category}
          </label>
        ))}
      </div>
      {message && <p style={message === "Saved" ? styles.successNote : styles.errorNote}>{message}</p>}
    </section>
  );
}

function activityLabel(update) {
  if (update.type === "solution") return "Solution";
  if (update.type === "comment") return "Comment";
  return update.status === "shipped" ? "Shipped" : "Building";
}

function activityHeadline(update) {
  if (update.type === "solution") {
    const actor = update.startup_name || update.actor_name;
    return `${actor} posted "${update.headline}"`;
  }
  if (update.type === "comment") {
    const actor = update.startup_name ? `${update.startup_name} via ${update.actor_name}` : update.actor_name;
    return `${actor} commented`;
  }
  return `${update.startup_name} ${update.status === "shipped" ? "shipped a fix" : "is building a fix"}`;
}

function EmptyNote({ children }) {
  return <p style={styles.emptyNote}>{children}</p>;
}

function Stat({ label, value, helper }) {
  return (
    <div style={styles.stat}>
      <span className="mono" style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
      {helper && <span style={styles.statHelper}>{helper}</span>}
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
          {problem.solutionCount === 0 && <NoSolutionBadge />}
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
  wrap: { padding: "40px 28px 80px", maxWidth: 960 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 16, flexWrap: "wrap" },
  h1: { fontSize: 28, marginBottom: 6 },
  h2: { fontSize: 19, marginTop: 26, marginBottom: 8 },
  sub: { fontSize: 14.5, color: "var(--text-dim)" },
  hint: { fontSize: 13, color: "var(--text-dim)", marginBottom: 14, lineHeight: 1.5 },
  tabs: { display: "inline-flex", gap: 4, border: "1.5px solid var(--line)", padding: 4, borderRadius: 4, background: "#fff" },
  tab: {
    border: "none", background: "transparent", padding: "9px 14px", borderRadius: 3,
    fontSize: 13.5, fontWeight: 600, color: "var(--text-dim)",
  },
  activeTab: { background: "var(--ink)", color: "var(--paper)" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 },
  metricCard: { padding: 20 },
  metricValue: { fontSize: 28, fontWeight: 700, margin: "4px 0", fontFamily: "var(--display)" },
  metricHelper: { fontSize: 12.5, color: "var(--text-dim)" },
  twoCol: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22 },
  interestsCard: { padding: 18, marginBottom: 24 },
  interestsHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 12 },
  interestsTitle: { fontSize: 18, marginBottom: 4 },
  interestGrid: { display: "flex", gap: 8, flexWrap: "wrap" },
  interestOption: {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 10px",
    border: "1.5px solid var(--line)", borderRadius: 3, background: "#fff",
    fontSize: 13, cursor: "pointer",
  },
  successNote: { color: "var(--build)", fontSize: 12.5, fontWeight: 600, marginTop: 10 },
  errorNote: { color: "var(--signal)", fontSize: 12.5, fontWeight: 600, marginTop: 10 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 12 },
  select: {
    padding: "10px 13px", borderRadius: 3, border: "1.5px solid var(--line)",
    fontSize: 14, background: "#fff",
  },
  emptyState: { padding: "70px 24px", textAlign: "center", border: "1.5px dashed var(--line)", borderRadius: 4, maxWidth: 620, margin: "30px auto" },
  emptyNote: { fontSize: 13.5, color: "var(--text-dim)", padding: "18px 0", lineHeight: 1.55 },
  inlineLink: { fontWeight: 600, color: "var(--ink)" },
  summaryPanel: { padding: 22 },
  summaryName: { fontFamily: "var(--display)", fontSize: 19, fontWeight: 700 },
  summaryTagline: { fontSize: 13, color: "var(--text-dim)", marginTop: 3, marginBottom: 18 },
  summaryStats: { display: "flex", gap: 26, flexWrap: "wrap" },
  reachGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  stat: { display: "flex", flexDirection: "column", gap: 3 },
  statValue: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 11.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 },
  statHelper: { fontSize: 11, color: "var(--build)", fontWeight: 600 },
  countNote: { color: "var(--text-dim)", fontSize: 14 },
  problemMini: { padding: 16, marginBottom: 10 },
  problemMiniTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 7 },
  badgeRow: { display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap" },
  problemTitle: { fontFamily: "var(--display)", fontSize: 16, fontWeight: 650 },
  problemDesc: {
    fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.45, marginBottom: 10,
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
  },
  problemMeta: { display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--text-dim)" },
  activityList: { display: "flex", flexDirection: "column", gap: 10 },
  activityItem: { display: "block", padding: 16 },
  activityTop: { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 },
  activityType: { fontSize: 11, color: "var(--spark)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 },
  activityDate: { fontSize: 11.5, color: "var(--text-dim)" },
  activityTitle: { fontSize: 14.5, fontWeight: 650, marginBottom: 3 },
  activityProblem: { fontSize: 12.5, color: "var(--text-dim)", marginBottom: 7 },
  activityBody: {
    fontSize: 13, color: "var(--text-dim)", lineHeight: 1.45,
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
  },
  lead: { padding: 18, marginBottom: 12, display: "flex", gap: 14 },
  leadTop: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 },
  leadTitle: { fontFamily: "var(--display)", fontSize: 16.5, fontWeight: 600 },
  leadDesc: {
    fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 10,
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
  },
  leadFooter: { display: "flex", gap: 16, fontSize: 12, color: "var(--text-dim)", flexWrap: "wrap" },
};
