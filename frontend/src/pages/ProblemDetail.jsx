import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import VoteControl from "../components/VoteControl.jsx";
import { StarsDisplay, StarsInput } from "../components/Stars.jsx";

export default function ProblemDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();

  const [problem, setProblem] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSolutionForm, setShowSolutionForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [probData, solData] = await Promise.all([
        api.getProblem(id, token),
        api.listSolutions(id, token),
      ]);
      setProblem(probData.problem);
      setSolutions(solData.solutions);
      setCanReview(solData.canReview);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = async (type, reason) => {
    if (reason === "auth-required") {
      setError("Log in to vote on this problem.");
      return;
    }
    try {
      const data = await api.vote(id, type, token);
      setProblem(data.problem);
      // Voting changes stake, so canReview may now change — refresh solution list quietly.
      const solData = await api.listSolutions(id, token);
      setSolutions(solData.solutions);
      setCanReview(solData.canReview);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="wrap" style={{ padding: 48 }}>Loading…</div>;
  if (error && !problem) return <div className="wrap" style={{ padding: 48 }}><div className="error-banner">{error}</div></div>;
  if (!problem) return null;

  return (
    <div className="wrap" style={styles.wrap}>
      <Link to="/problems" style={styles.back}>← Back to problems</Link>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={styles.problemCard}>
        <VoteControl problem={problem} onVote={handleVote} size="lg" />
        <div style={{ flex: 1 }}>
          <span style={styles.category}>{problem.category}</span>
          <h1 style={styles.title}>{problem.title}</h1>
          <p style={styles.meta}>
            Posted by {problem.author_name} · {new Date(problem.created_at).toLocaleDateString()}
          </p>
          <p style={styles.desc}>{problem.description}</p>
        </div>
      </div>

      <div style={styles.solutionsHeader}>
        <h2 style={styles.h2}>
          Solutions <span className="mono" style={{ color: "var(--text-dim)", fontSize: 16 }}>({solutions.length})</span>
        </h2>
        {user && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowSolutionForm((v) => !v)}>
            {showSolutionForm ? "Cancel" : "Provide a solution"}
          </button>
        )}
      </div>

      {!user && (
        <p style={styles.hint}>
          <Link to="/login" style={{ fontWeight: 600 }}>Log in</Link> to upvote, provide a solution, or leave a review.
        </p>
      )}

      {user && !canReview && (
        <p style={styles.hint}>
          Only people who posted or voted on this problem can review its solutions.{" "}
          Cast a vote above to unlock reviewing.
        </p>
      )}

      {showSolutionForm && (
        <SolutionForm
          problemId={id}
          token={token}
          onCreated={(sol) => {
            setSolutions((prev) => [sol, ...prev]);
            setShowSolutionForm(false);
          }}
        />
      )}

      {solutions.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>No one has built a solution yet.</p>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Be the first to solve it.</p>
        </div>
      ) : (
        solutions.map((sol) => (
          <SolutionCard
            key={sol.id}
            solution={sol}
            canReview={canReview}
            token={token}
            onReviewed={(updated) =>
              setSolutions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
            }
          />
        ))
      )}
    </div>
  );
}

function SolutionForm({ problemId, token, onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", link: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api.provideSolution(problemId, form, token);
      onCreated(data.solution);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={styles.solutionForm}>
      <h3 style={{ marginBottom: 14, fontSize: 17 }}>Provide a solution</h3>
      {error && <div className="error-banner">{error}</div>}
      <div className="field">
        <label>Product / project name</label>
        <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="field">
        <label>How does it solve the problem?</label>
        <textarea
          required
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Link (optional)</label>
        <input
          type="url"
          placeholder="https://…"
          value={form.link}
          onChange={(e) => setForm({ ...form, link: e.target.value })}
        />
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit solution"}</button>
    </form>
  );
}

function SolutionCard({ solution, canReview, token, onReviewed }) {
  const [reviews, setReviews] = useState([]);
  const [showReviews, setShowReviews] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(solution.myReview?.rating || 5);
  const [feedback, setFeedback] = useState(solution.myReview?.feedback || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadReviews = async () => {
    const data = await api.listReviews(solution.id);
    setReviews(data.reviews);
    setShowReviews(true);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.submitReview(solution.id, { rating, feedback }, token);
      const [solData, revData] = await Promise.all([
        api.getProblem(solution.problem_id, token).catch(() => null),
        api.listReviews(solution.id),
      ]);
      setReviews(revData.reviews);
      setShowForm(false);
      setShowReviews(true);
      // refresh just this solution's aggregate rating via the solutions list caller
      const fresh = await fetch(`/api/solutions/${solution.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.json());
      if (fresh.solution) onReviewed(fresh.solution);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={styles.solutionCard}>
      <div style={styles.solutionTop}>
        <div>
          <h3 style={styles.solutionTitle}>{solution.title}</h3>
          <p style={styles.solutionAuthor}>built by {solution.author_name}</p>
        </div>
        <StarsDisplay value={solution.avgRating} count={solution.reviewCount} />
      </div>

      <p style={styles.solutionDesc}>{solution.description}</p>

      {solution.link && (
        <a href={solution.link} target="_blank" rel="noopener noreferrer" style={styles.solutionLink}>
          View product ↗
        </a>
      )}

      <div style={styles.solutionActions}>
        <button className="btn btn-sm" onClick={() => (showReviews ? setShowReviews(false) : loadReviews())}>
          {showReviews ? "Hide reviews" : `View reviews (${solution.reviewCount})`}
        </button>
        {canReview && (
          <button className="btn btn-sm btn-primary" onClick={() => setShowForm((v) => !v)}>
            {solution.myReview ? "Edit your review" : "Approve / review"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submitReview} style={styles.reviewForm}>
          {error && <div className="error-banner">{error}</div>}
          <div style={{ marginBottom: 12 }}>
            <StarsInput value={rating} onChange={setRating} />
          </div>
          <textarea
            rows={3}
            placeholder="What worked? What didn't?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            style={{ width: "100%", marginBottom: 12 }}
          />
          <button className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? "Saving…" : "Submit review"}
          </button>
        </form>
      )}

      {showReviews && (
        <div style={styles.reviewsList}>
          {reviews.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "var(--text-dim)" }}>No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} style={styles.reviewItem}>
                <div style={styles.reviewHeader}>
                  <strong style={{ fontSize: 13.5 }}>{r.author_name}</strong>
                  <StarsDisplay value={r.rating} />
                </div>
                {r.feedback && <p style={styles.reviewFeedback}>{r.feedback}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { padding: "32px 28px 90px", maxWidth: 820 },
  back: { fontSize: 13.5, color: "var(--text-dim)", display: "inline-block", marginBottom: 20 },
  problemCard: { display: "flex", gap: 24, padding: 28, marginBottom: 36 },
  category: {
    fontFamily: "var(--mono)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.5,
    color: "var(--ink)", background: "var(--paper-dim)", padding: "3px 8px", borderRadius: 2,
  },
  title: { fontSize: 26, fontWeight: 700, margin: "12px 0 8px" },
  meta: { fontSize: 13, color: "var(--text-dim)", marginBottom: 16 },
  desc: { fontSize: 15.5, lineHeight: 1.6, color: "var(--text)" },
  solutionsHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  h2: { fontSize: 20 },
  hint: { fontSize: 13.5, color: "var(--text-dim)", marginBottom: 18, background: "var(--paper-dim)", padding: "10px 14px", borderRadius: 3 },
  emptyState: { padding: "48px 0", textAlign: "center", border: "1.5px dashed var(--line)", borderRadius: 4 },
  solutionForm: { padding: 24, marginBottom: 20 },
  solutionCard: { padding: 22, marginBottom: 16 },
  solutionTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 },
  solutionTitle: { fontSize: 17, fontWeight: 600 },
  solutionAuthor: { fontSize: 12.5, color: "var(--text-dim)", marginTop: 2 },
  solutionDesc: { fontSize: 14, lineHeight: 1.55, color: "var(--text)", marginBottom: 10 },
  solutionLink: { fontSize: 13, fontWeight: 600, color: "var(--build)", display: "inline-block", marginBottom: 14 },
  solutionActions: { display: "flex", gap: 10, marginBottom: 4 },
  reviewForm: { marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16 },
  reviewsList: { marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 },
  reviewItem: { paddingBottom: 12, borderBottom: "1px solid var(--line)" },
  reviewHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  reviewFeedback: { fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5 },
};
