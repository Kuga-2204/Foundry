import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ProblemCard from "../components/ProblemCard.jsx";

export default function Problems() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [problems, setProblems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const sort = searchParams.get("sort") || "top";
  const category = searchParams.get("category") || "All";
  const mine = searchParams.get("mine") === "true";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { sort };
      if (category !== "All") params.category = category;
      if (searchParams.get("search")) params.search = searchParams.get("search");
      if (mine) params.mine = "true";
      const data = await api.listProblems(params, token);
      setProblems(data.problems);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sort, category, mine, searchParams, token]);

  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    try {
      const data = await api.vote(id, type, token);
      setProblems((prev) => prev.map((p) => (p.id === id ? data.problem : p)));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="wrap" style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>{mine ? "My problems" : "Browse problems"}</h1>
          <p style={styles.sub}>
            {mine ? "Problems you've posted." : "Real problems, ranked by how many people share them."}
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
          <option value="top">Top voted</option>
          <option value="new">Newest</option>
          <option value="unsolved">Unsolved</option>
          <option value="solved">Most built</option>
        </select>

        <select value={category} onChange={(e) => updateParam("category", e.target.value)} style={styles.select}>
          <option value="All">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p style={styles.empty}>Loading…</p>
      ) : problems.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>No problems here yet.</p>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Be the first — <Link to="/post" style={{ fontWeight: 600 }}>post one</Link>.
          </p>
        </div>
      ) : (
        problems.map((p) => <ProblemCard key={p.id} problem={p} onVote={handleVote} />)
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
  empty: { color: "var(--text-dim)", padding: "40px 0", textAlign: "center" },
  emptyState: { padding: "60px 0", textAlign: "center", border: "1.5px dashed var(--line)", borderRadius: 4 },
};
