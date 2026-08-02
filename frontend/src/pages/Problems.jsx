import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ProblemCard from "../components/ProblemCard.jsx";
import WelcomeBanner from "../components/WelcomeBanner.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";
import { optimisticVote } from "../voteUtils.js";

export default function Problems() {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [problems, setProblems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [votingIds, setVotingIds] = useState(() => new Set());
  const [followingIds, setFollowingIds] = useState(() => new Set());
  const [socialDiscovery, setSocialDiscovery] = useState({ results: [], grouped: {}, searched: false });
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState("");

  const sort = searchParams.get("sort") || "discover";
  const category = searchParams.get("category") || "All";
  const status = searchParams.get("status") || "All";
  const mine = searchParams.get("mine") === "true";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { sort };
      if (category !== "All") params.category = category;
      if (status !== "All") params.status = status;
      if (searchParams.get("search")) params.search = searchParams.get("search");
      if (mine) params.mine = "true";
      const data = await api.listProblems(params, token);
      setProblems(data.problems);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sort, category, status, mine, searchParams, token]);

  const loadSocialDiscovery = useCallback(async (refresh = false) => {
    setSocialLoading(true);
    setSocialError("");
    try {
      const params = { category };
      if (refresh) params.refresh = "true";
      const data = await api.socialProblemDiscovery(params);
      setSocialDiscovery(data);
    } catch (err) {
      setSocialError(err.message);
    } finally {
      setSocialLoading(false);
    }
  }, [category]);
  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSocialDiscovery();
  }, [loadSocialDiscovery]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "All") next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    updateParam("search", search);
  };

  const handleVote = async (id, type, reason) => {
    if (reason === "auth-required") {
      setError("Log in to vote on a problem.");
      return;
    }
    if (votingIds.has(id)) return;
    const previous = problems;
    setError("");
    setVotingIds((prev) => new Set(prev).add(id));
    setProblems((prev) => prev.map((p) => (p.id === id ? optimisticVote(p, type) : p)));
    try {
      const data = await api.vote(id, type, token);
      setProblems((prev) => prev.map((p) => (p.id === id ? data.problem : p)));
    } catch (err) {
      setProblems(previous);
      setError(err.message);
    } finally {
      setVotingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleFollow = async (id) => {
    if (!user) {
      setError("Log in to follow a problem.");
      return;
    }
    if (followingIds.has(id)) return;
    setError("");
    setFollowingIds((prev) => new Set(prev).add(id));
    try {
      const data = await api.followProblem(id, token);
      setProblems((prev) => prev.map((p) => (p.id === id ? data.problem : p)));
    } catch (err) {
      setError(err.message);
    } finally {
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const socialGroups = Object.entries(socialDiscovery.grouped || {});
  const showSocialDiscovery = !mine && !searchParams.get("search");
  return (
    <div className="wrap" style={styles.wrap}>
      {!mine && <WelcomeBanner />}
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>
            {mine ? "My problems" : sort === "discover" || sort === "trending" ? "Discover problems" : "Browse problems"}
          </h1>
          <p style={styles.sub}>
            {mine
              ? "Problems you've posted."
              : sort === "discover" || sort === "trending"
                ? "Problems ranked by your interests, demand, and unsolved opportunity."
                : "Real problems from real people. Vote if you have it too, follow to hear when it gets solved."}
          </p>
        </div>
        <Link to="/post" className="btn btn-primary">Post a problem</Link>
      </div>

      <div style={styles.controls}>
        <form onSubmit={handleSearch} style={styles.search}>
          <input
            placeholder="Search problems…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </form>

        <select value={sort} onChange={(e) => updateParam("sort", e.target.value)} style={styles.select}>
          <option value="discover">Discover</option>
          <option value="top">Top voted</option>
          <option value="new">Newest</option>
          <option value="followed">Most followed</option>
          <option value="unsolved">Unsolved</option>
        </select>

        <select value={status} onChange={(e) => updateParam("status", e.target.value)} style={styles.select}>
          <option value="All">Any status</option>
          <option value="open">Open</option>
          <option value="building">In progress</option>
          <option value="solved">Solved</option>
        </select>

        <select value={category} onChange={(e) => updateParam("category", e.target.value)} style={styles.select}>
          <option value="All">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showSocialDiscovery && (
        <section style={styles.socialSection}>
          <div style={styles.socialHead}>
            <div>
              <span className="mono" style={styles.socialKicker}>SOCIAL RADAR</span>
              <h2 style={styles.socialTitle}>Latest problems people are talking about</h2>
            </div>
            <button className="btn btn-sm" type="button" onClick={() => loadSocialDiscovery(true)} disabled={socialLoading}>
              {socialLoading ? "Searching" : "Refresh"}
            </button>
          </div>
          {socialError ? (
            <p style={styles.socialMuted}>{socialError}</p>
          ) : socialLoading && socialGroups.length === 0 ? (
            <p style={styles.socialMuted}>Searching Reddit, X, LinkedIn, Hacker News, and Quora.</p>
          ) : socialGroups.length === 0 ? (
            <p style={styles.socialMuted}>No fresh social problems found yet.</p>
          ) : (
            <div style={styles.socialGrid}>
              {socialGroups.map(([groupCategory, items]) => (
                <div key={groupCategory} style={styles.socialGroup}>
                  <h3 style={styles.socialCategory}>{groupCategory}</h3>
                  {items.slice(0, 4).map((item) => (
                    <a key={`${item.source}-${item.url}`} href={item.url} target="_blank" rel="noopener noreferrer" style={styles.socialItem}>
                      <span style={styles.socialMeta}>{item.source} - {item.posted_at || "Recent"}</span>
                      <strong style={styles.socialItemTitle}>{item.title}</strong>
                      <span style={styles.socialDesc}>{item.description}</span>
                      {item.evidence && <span style={styles.socialEvidence}>{item.evidence}</span>}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {loading ? (
        <LoadingScreen label="Searching problems" />
      ) : problems.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>No problems here yet.</p>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Be the first to <Link to="/post" style={{ fontWeight: 600 }}>post one</Link>.
          </p>
        </div>
      ) : (
        problems.map((p) => (
          <ProblemCard
            key={p.id}
            problem={p}
            onVote={handleVote}
            onFollow={handleFollow}
            voting={votingIds.has(p.id)}
            following={followingIds.has(p.id)}
          />
        ))
      )}
    </div>
  );
}

const styles = {
  wrap: { padding: "40px 28px 80px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, gap: 16, flexWrap: "wrap" },
  h1: { fontSize: 28, marginBottom: 6 },
  sub: { fontSize: 14.5, color: "var(--text-dim)" },
  controls: { display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" },
  search: { flex: 1, minWidth: 220 },
  searchInput: {
    width: "100%",
    padding: "11px 13px",
    borderRadius: 3,
    border: "1.5px solid var(--line)",
    fontSize: 14.5,
  },
  select: {
    padding: "11px 13px",
    borderRadius: 3,
    border: "1.5px solid var(--line)",
    fontSize: 14,
    background: "#fff",
  },
  socialSection: {
    border: "1.5px solid var(--line)",
    background: "#f7f8f0",
    padding: 18,
    marginBottom: 24,
    borderRadius: 4,
  },
  socialHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" },
  socialKicker: { fontSize: 11, fontWeight: 700, color: "var(--text-dim)", letterSpacing: 1.2 },
  socialTitle: { fontSize: 18, marginTop: 3 },
  socialMuted: { color: "var(--text-dim)", fontSize: 14 },
  socialGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 },
  socialGroup: { minWidth: 0 },
  socialCategory: { fontSize: 13, marginBottom: 8, color: "var(--ink)" },
  socialItem: {
    display: "block",
    textDecoration: "none",
    color: "inherit",
    background: "#fff",
    border: "1px solid var(--line)",
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  socialMeta: { display: "block", fontSize: 11.5, color: "var(--text-dim)", marginBottom: 5, fontWeight: 600 },
  socialItemTitle: { display: "block", fontSize: 14, lineHeight: 1.35, marginBottom: 5 },
  socialDesc: { display: "block", fontSize: 13, lineHeight: 1.45, color: "var(--text)" },
  socialEvidence: { display: "block", fontSize: 12.5, lineHeight: 1.4, color: "var(--text-dim)", marginTop: 6 },
  empty: { color: "var(--text-dim)", padding: "40px 0", textAlign: "center" },
  emptyState: { padding: "60px 0", textAlign: "center", border: "1.5px dashed var(--line)", borderRadius: 4 },
};
