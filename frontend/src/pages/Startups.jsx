import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import StartupCard from "../components/StartupCard.jsx";

export default function Startups() {
  const [startups, setStartups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (category !== "All") params.category = category;
      if (query) params.search = query;
      const data = await api.listStartups(params);
      setStartups(data.startups);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [category, query]);

  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="wrap" style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Startup directory</h1>
          <p style={styles.sub}>
            Startups solving real problems from this board. Yours missing?{" "}
            Add it and get matched to people describing the exact problem you solve.
          </p>
        </div>
        <Link to="/startups/new" className="btn btn-primary">Add your startup</Link>
      </div>

      <div style={styles.controls}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
          }}
          style={styles.search}
        >
          <input
            placeholder="Search startups…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </form>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.select}>
          <option value="All">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p style={styles.empty}>Loading…</p>
      ) : startups.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>No startups listed yet.</p>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Be the first: <Link to="/startups/new" style={{ fontWeight: 600 }}>add your startup</Link>.
          </p>
        </div>
      ) : (
        startups.map((s) => <StartupCard key={s.id} startup={s} />)
      )}
    </div>
  );
}

const styles = {
  wrap: { padding: "40px 28px 80px", maxWidth: 860 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, gap: 16, flexWrap: "wrap" },
  h1: { fontSize: 28, marginBottom: 6 },
  sub: { fontSize: 14.5, color: "var(--text-dim)", maxWidth: 520, lineHeight: 1.5 },
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
