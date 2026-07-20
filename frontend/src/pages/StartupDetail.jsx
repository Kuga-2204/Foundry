import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { StarsDisplay } from "../components/Stars.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatDate } from "../utils.js";

export default function StartupDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [startup, setStartup] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getStartup(id, token);
      setStartup(data.startup);
      setSolutions(data.solutions);
      setCommitments(data.commitments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async () => {
    if (!user || !token) {
      navigate("/login", { state: { from: `/startups/${id}` } });
      return;
    }
    setClaiming(true);
    setError("");
    try {
      await api.claimStartup(id, token);
      await load();
    } catch (err) {
      setError(
        err.message === "Something went wrong. Please try again."
          ? "We couldn't claim this startup right now. Please try again in a moment."
          : err.message
      );
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <div className="wrap" style={{ padding: 48 }}>Loading…</div>;
  if (error && !startup)
    return (
      <div className="wrap" style={{ padding: 48 }}>
        <div className="error-banner">{error}</div>
      </div>
    );
  if (!startup) return null;

  return (
    <div className="wrap" style={styles.wrap}>
      <Link to="/startups" style={styles.back}>← Back to startups</Link>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={styles.profileCard}>
        <div style={styles.profileTop}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.nameRow}>
              <h1 style={styles.name}>{startup.name}</h1>
              {startup.claimed ? (
                <span className="mono" style={styles.claimedBadge}>✓ On Solvyard</span>
              ) : (
                <span className="mono" style={styles.unclaimedBadge}>Unclaimed profile</span>
              )}
            </div>
            <p style={styles.tagline}>{startup.tagline}</p>
          </div>
          <div style={styles.actions}>
            {startup.isOwner && (
              <Link to={`/startups/${startup.id}/edit`} className="btn btn-sm">Edit profile</Link>
            )}
            {!startup.claimed && (
              <button className="btn btn-sm btn-primary" onClick={claim} disabled={claiming}>
                {claiming ? "Claiming…" : "This is my startup"}
              </button>
            )}
          </div>
        </div>

        <p style={styles.desc}>{startup.description}</p>

        <div style={styles.statsRow}>
          <span className="mono" style={styles.category}>{startup.category}</span>
          {startup.reviewCount > 0 && (
            <StarsDisplay value={startup.avgRating} count={startup.reviewCount} />
          )}
          {startup.website && (
            <a href={startup.website} target="_blank" rel="noopener noreferrer" style={styles.site}>
              Visit website ↗
            </a>
          )}
        </div>
      </div>

      <h2 style={styles.h2}>Problems we solve</h2>
      {startup.statements.length === 0 ? (
        <p style={styles.emptyNote}>No statements yet.</p>
      ) : (
        <div style={styles.statements}>
          {startup.statements.map((s) => (
            <div key={s.id} className="card" style={styles.statement}>
              "{s.statement}"
            </div>
          ))}
        </div>
      )}

      {commitments.length > 0 && (
        <>
          <h2 style={styles.h2}>Commitments</h2>
          {commitments.map((c) => (
            <div key={c.id} className="card" style={styles.commitment}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/problems/${c.problem_id}`} style={styles.commitmentTitle}>
                  {c.problem_title}
                </Link>
                {c.note && <p style={styles.commitmentNote}>{c.note}</p>}
              </div>
              <StatusBadge status={c.status === "shipped" ? "solved" : "building"} />
            </div>
          ))}
        </>
      )}

      <h2 style={styles.h2}>Solutions posted</h2>
      {solutions.length === 0 ? (
        <p style={styles.emptyNote}>No solutions posted on problems yet.</p>
      ) : (
        solutions.map((s) => (
          <div key={s.id} className="card" style={styles.solution}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={styles.solutionTitle}>{s.title}</p>
              <p style={styles.solutionMeta}>
                on <Link to={`/problems/${s.problem_id}`} style={{ fontWeight: 600 }}>{s.problem_title}</Link>
                {" · "}{formatDate(s.created_at)}
              </p>
            </div>
            {s.reviewCount > 0 && <StarsDisplay value={s.avgRating} count={s.reviewCount} />}
          </div>
        ))
      )}
    </div>
  );
}

const styles = {
  wrap: { padding: "32px 28px 90px", maxWidth: 820 },
  back: { fontSize: 13.5, color: "var(--text-dim)", display: "inline-block", marginBottom: 20 },
  profileCard: { padding: 28, marginBottom: 32 },
  profileTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 14 },
  nameRow: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 },
  name: { fontSize: 26, fontWeight: 700 },
  claimedBadge: {
    fontSize: 11, fontWeight: 600, color: "var(--ink)", background: "var(--build)",
    padding: "3px 9px", borderRadius: 2, letterSpacing: 0.4,
  },
  unclaimedBadge: {
    fontSize: 11, fontWeight: 600, color: "var(--text-dim)", border: "1px solid var(--line)",
    padding: "3px 9px", borderRadius: 2, letterSpacing: 0.4,
  },
  tagline: { fontSize: 15, color: "var(--text-dim)" },
  actions: { display: "flex", gap: 10, flexShrink: 0 },
  desc: { fontSize: 14.5, lineHeight: 1.6, color: "var(--text)", marginBottom: 16 },
  statsRow: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  category: {
    fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5,
    color: "var(--ink)", background: "var(--paper-dim)", padding: "3px 8px", borderRadius: 2,
  },
  site: { fontSize: 13, fontWeight: 600, color: "var(--build)" },
  h2: { fontSize: 19, marginBottom: 14, marginTop: 28 },
  emptyNote: { fontSize: 13.5, color: "var(--text-dim)" },
  statements: { display: "flex", flexDirection: "column", gap: 8 },
  statement: { padding: "12px 16px", fontSize: 14, fontStyle: "italic", color: "var(--text)" },
  commitment: { padding: "14px 18px", marginBottom: 10, display: "flex", alignItems: "center", gap: 14 },
  commitmentTitle: { fontSize: 14.5, fontWeight: 600 },
  commitmentNote: { fontSize: 13, color: "var(--text-dim)", marginTop: 3 },
  solution: { padding: "14px 18px", marginBottom: 10, display: "flex", alignItems: "center", gap: 14 },
  solutionTitle: { fontSize: 14.5, fontWeight: 600 },
  solutionMeta: { fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 },
};
