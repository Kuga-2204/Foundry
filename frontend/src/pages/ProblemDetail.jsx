import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import StartupCard from "../components/StartupCard.jsx";
import ShareButton from "../components/ShareButton.jsx";
import ReportButton from "../components/ReportButton.jsx";
import MeTooButton from "../components/MeTooButton.jsx";
import { StarsDisplay, StarsInput } from "../components/Stars.jsx";
import { formatDate, OUTCOME_LABELS, OUTCOME_COLORS } from "../utils.js";

export default function ProblemDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();

  const [problem, setProblem] = useState(null);
  const [commitments, setCommitments] = useState([]);
  const [solutions, setSolutions] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [matches, setMatches] = useState({ strong: [], adjacent: [] });
  const [myStartups, setMyStartups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSolutionForm, setShowSolutionForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [probData, solData, matchData] = await Promise.all([
        api.getProblem(id, token),
        api.listSolutions(id, token),
        api.problemMatches(id),
      ]);
      setProblem(probData.problem);
      setCommitments(probData.commitments || []);
      setSolutions(solData.solutions);
      setCanReview(solData.canReview);
      setMatches(matchData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) {
      setMyStartups([]);
      return;
    }
    api.myStartups(token).then((d) => setMyStartups(d.startups)).catch(() => {});
  }, [user, token]);

  const refreshStake = async () => {
    const solData = await api.listSolutions(id, token);
    setSolutions(solData.solutions);
    setCanReview(solData.canReview);
  };

  const handleVote = async (type, reason) => {
    if (reason === "auth-required") {
      setError("Log in to vote on this problem.");
      return;
    }
    try {
      const data = await api.vote(id, type, token);
      setProblem(data.problem);
      await refreshStake();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFollow = async () => {
    if (!user) {
      setError("Log in to follow this problem.");
      return;
    }
    try {
      const data = await api.followProblem(id, token);
      setProblem(data.problem);
    } catch (err) {
      setError(err.message);
    }
  };

  const reloadProblem = async () => {
    const probData = await api.getProblem(id, token);
    setProblem(probData.problem);
    setCommitments(probData.commitments || []);
  };

  if (loading) return <div className="wrap" style={{ padding: 48 }}>Loading…</div>;
  if (error && !problem)
    return (
      <div className="wrap" style={{ padding: 48 }}>
        <div className="error-banner">{error}</div>
      </div>
    );
  if (!problem) return null;

  return (
    <div className="wrap" style={styles.wrap}>
      <Link to="/problems" style={styles.back}>← Back to problems</Link>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={styles.problemCard}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.badgeRow}>
            <span style={styles.category}>{problem.category}</span>
            <StatusBadge status={problem.status} size="md" />
          </div>
          <h1 style={styles.title}>{problem.title}</h1>
          <p style={styles.meta}>
            Posted by{" "}
            {problem.user_id ? (
              <Link to={`/users/${problem.user_id}`} style={styles.authorLink}>
                {problem.author_name}
              </Link>
            ) : (
              problem.author_name
            )}{" "}
            · {formatDate(problem.created_at)} · {problem.followerCount} following
          </p>
          <p style={styles.desc}>{problem.description}</p>
          {problem.media?.length > 0 && <MediaGallery media={problem.media} />}
          <div style={styles.problemActions}>
            <MeTooButton problem={problem} onVoted={(p) => setProblem(p)} />
            <button
              className="btn btn-sm"
              aria-pressed={problem.myVote === -1}
              title="Not relevant to me"
              onClick={() => (user ? handleVote(-1) : handleVote(null, "auth-required"))}
              style={
                problem.myVote === -1
                  ? { background: "var(--signal)", borderColor: "var(--signal)", color: "#fff" }
                  : undefined
              }
            >
              {problem.myVote === -1 ? "✓ Not for me" : "Not relevant"}
            </button>
            <button className="btn btn-sm" onClick={handleFollow}>
              {problem.isFollowing ? "Following ✓" : "Follow for updates"}
            </button>
            <ShareButton problem={problem} />
            <span style={{ marginLeft: "auto", alignSelf: "center" }}>
              <ReportButton targetType="problem" targetId={problem.id} />
            </span>
          </div>
        </div>
      </div>

      {commitments.length > 0 && (
        <div style={styles.commitmentsBox}>
          <p className="mono" style={styles.commitmentsLabel}>ON IT</p>
          {commitments.map((c) => (
            <div key={c.id} style={styles.commitmentRow}>
              <Link to={`/startups/${c.startup_id}`} style={{ fontWeight: 600, fontSize: 14 }}>
                {c.startup_name}
              </Link>
              <span style={styles.commitmentStatus}>
                {c.status === "shipped" ? "shipped a fix" : "is building a fix"}
              </span>
              {c.note && <span style={styles.commitmentNote}>"{c.note}"</span>}
            </div>
          ))}
        </div>
      )}

      {matches.strong.length > 0 && (
        <>
          <h2 style={styles.h2}>Startups that may already solve this</h2>
          <p style={styles.hint}>
            Matched from the directory by what they say they solve. Tried one? Vote on the
            problem to unlock reviewing.
          </p>
          {matches.strong.map((s) => (
            <StartupCard key={s.id} startup={s} matched />
          ))}
        </>
      )}

      {user && myStartups.length > 0 && (
        <StartupActions
          problem={problem}
          commitments={commitments}
          myStartups={myStartups}
          token={token}
          onChanged={reloadProblem}
        />
      )}

      <div style={styles.solutionsHeader}>
        <h2 style={styles.h2}>
          Solutions{" "}
          <span className="mono" style={{ color: "var(--text-dim)", fontSize: 16 }}>
            ({solutions.length})
          </span>
        </h2>
        {user && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowSolutionForm((v) => !v)}>
            {showSolutionForm ? "Cancel" : "Post a solution"}
          </button>
        )}
      </div>

      {!user && (
        <p style={styles.hint}>
          <Link to="/login" style={{ fontWeight: 600 }}>Log in</Link> to vote, follow, post a
          solution, or leave a review.
        </p>
      )}

      {user && !canReview && (
        <p style={styles.hint}>
          Only people who posted or voted on this problem can review its solutions. Cast a
          vote above to unlock reviewing.
        </p>
      )}

      {showSolutionForm && (
        <SolutionForm
          problemId={id}
          token={token}
          myStartups={myStartups}
          onCreated={(sol) => {
            setSolutions((prev) => [sol, ...prev]);
            setShowSolutionForm(false);
          }}
        />
      )}

      {solutions.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>No solutions posted yet.</p>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Solve this and everyone following it hears about you.
          </p>
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

      <Discussion problemId={id} user={user} token={token} myStartups={myStartups} />
    </div>
  );
}

// Photos and videos attached to the problem. Images open full-size in a
// lightbox; videos play inline.
function MediaGallery({ media }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      <div style={styles.gallery}>
        {media.map((m) =>
          m.kind === "video" ? (
            <video key={m.id} src={m.file} controls preload="metadata" style={styles.galleryVideo} />
          ) : (
            <img
              key={m.id}
              src={m.file}
              alt="Problem attachment"
              style={styles.galleryImage}
              onClick={() => setOpen(m.file)}
            />
          )
        )}
      </div>
      {open && (
        <div style={styles.lightbox} onClick={() => setOpen(null)}>
          <img src={open} alt="Attachment, full size" style={styles.lightboxImg} />
        </div>
      )}
    </>
  );
}

// Discussion thread under a problem. Startup owners can comment as their
// startup: that's how they ask clarifying questions before committing.
function Discussion({ problemId, user, token, myStartups }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [asStartup, setAsStartup] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.listComments(problemId, token);
      setComments(d.comments);
    } catch {
      // non-critical; the rest of the page still works
    }
  }, [problemId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setError("");
    setBusy(true);
    try {
      const payload = { body };
      if (asStartup) payload.startup_id = Number(asStartup);
      await api.postComment(problemId, payload, token);
      setBody("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 36 }}>
      <h2 style={styles.h2}>
        Discussion{" "}
        <span className="mono" style={{ color: "var(--text-dim)", fontSize: 16 }}>
          ({comments.length})
        </span>
      </h2>
      <p style={styles.hint}>
        Questions, context, "me too" stories. Startups: ask the poster anything before you
        commit to building.
      </p>

      {comments.length > 0 && (
        <div style={styles.commentList}>
          {comments.map((c) => (
            <div key={c.id} style={styles.commentItem}>
              <div style={styles.commentHead}>
                <span style={styles.commentAuthor}>
                  {c.startup ? (
                    <>
                      <Link to={`/startups/${c.startup.id}`} style={{ fontWeight: 600 }}>
                        {c.startup.name}
                      </Link>
                      {c.startup.claimed ? " ✓" : ""}
                      <span className="mono" style={styles.startupChip}>STARTUP</span>
                      <span style={styles.commentVia}>via {c.author_name}</span>
                    </>
                  ) : c.author_id ? (
                    <Link to={`/users/${c.author_id}`} style={{ fontWeight: 600, fontSize: 13.5 }}>
                      {c.author_name}{c.isMine ? " (you)" : ""}
                    </Link>
                  ) : (
                    <strong style={{ fontSize: 13.5 }}>
                      {c.author_name}
                      {c.isMine ? " (you)" : ""}
                    </strong>
                  )}
                </span>
                <span style={styles.commentHeadRight}>
                  <span className="mono" style={styles.commentDate}>{formatDate(c.created_at)}</span>
                  <ReportButton targetType="comment" targetId={c.id} />
                </span>
              </div>
              <p style={styles.commentBody}>{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {user ? (
        <form onSubmit={submit} className="card" style={styles.commentForm}>
          {error && <div className="error-banner">{error}</div>}
          <textarea
            rows={3}
            placeholder="Add to the discussion…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <div style={styles.commentFormRow}>
            {myStartups.length > 0 && (
              <select
                value={asStartup}
                onChange={(e) => setAsStartup(e.target.value)}
                style={styles.startupSelect}
              >
                <option value="">Comment as myself</option>
                {myStartups.map((s) => (
                  <option key={s.id} value={s.id}>Comment as {s.name}</option>
                ))}
              </select>
            )}
            <button className="btn btn-primary btn-sm" disabled={busy || !body.trim()}>
              {busy ? "Posting…" : "Comment"}
            </button>
          </div>
        </form>
      ) : (
        <p style={styles.hint}>
          <Link to="/login" style={{ fontWeight: 600 }}>Log in</Link> to join the discussion.
        </p>
      )}
    </div>
  );
}

// Actions for startup owners: commit to building a fix, then mark it shipped.
function StartupActions({ problem, commitments, myStartups, token, onChanged }) {
  const [startupId, setStartupId] = useState(myStartups[0]?.id);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const mine = commitments.find((c) => c.startup_id === startupId);

  const commit = async () => {
    setError("");
    setBusy(true);
    try {
      await api.commit(problem.id, startupId, note, token);
      setNote("");
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ship = async () => {
    setError("");
    setBusy(true);
    try {
      await api.ship(problem.id, startupId, token);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={styles.startupActions}>
      <p className="mono" style={styles.startupActionsLabel}>FOR YOUR STARTUP</p>
      {error && <div className="error-banner">{error}</div>}

      <div style={styles.startupActionsRow}>
        {myStartups.length > 1 && (
          <select
            value={startupId}
            onChange={(e) => setStartupId(Number(e.target.value))}
            style={styles.startupSelect}
          >
            {myStartups.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {!mine ? (
          <>
            <input
              placeholder="Optional note, e.g. shipping this quarter"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={styles.noteInput}
            />
            <button className="btn btn-sm btn-primary" onClick={commit} disabled={busy}>
              {busy ? "Saving…" : "We're building this"}
            </button>
          </>
        ) : mine.status === "building" ? (
          <>
            <span style={styles.committedNote}>
              Committed as building. Followers were notified.
            </span>
            <button className="btn btn-sm btn-primary" onClick={ship} disabled={busy}>
              {busy ? "Saving…" : "Mark as shipped"}
            </button>
          </>
        ) : (
          <span style={styles.committedNote}>
            Shipped. Everyone following this problem was notified to try it and review.
          </span>
        )}
      </div>

      <BadgeEmbed problemId={problem.id} />
    </div>
  );
}

// Copyable snippet so a startup can show live demand for this problem on its
// own site. Every embed is a backlink to Solvyard.
function BadgeEmbed({ problemId }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const badgeUrl = `${window.location.origin}/badge/problem/${problemId}.svg`;
  const pageUrl = `${window.location.origin}/problems/${problemId}`;
  const snippet = `<a href="${pageUrl}" target="_blank" rel="noopener"><img src="${badgeUrl}" alt="See how many people want this on Solvyard" width="240" height="54"></a>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; the textarea below is selectable as fallback */
    }
  };

  return (
    <div style={styles.embedWrap}>
      <button style={styles.embedToggle} onClick={() => setOpen((v) => !v)}>
        {open ? "Hide demand badge" : "Embed a demand badge on your site ↗"}
      </button>
      {open && (
        <div style={styles.embedBody}>
          <img src={badgeUrl} alt="Demand badge preview" width="240" height="54" style={{ marginBottom: 10 }} />
          <textarea readOnly value={snippet} style={styles.embedCode} onClick={(e) => e.target.select()} />
          <button className="btn btn-sm" onClick={copy} style={{ marginTop: 8 }}>
            {copied ? "Copied ✓" : "Copy embed code"}
          </button>
        </div>
      )}
    </div>
  );
}

function SolutionForm({ problemId, token, myStartups, onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", link: "" });
  const [asStartup, setAsStartup] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = { ...form };
      if (asStartup) payload.startup_id = Number(asStartup);
      const data = await api.provideSolution(problemId, payload, token);
      onCreated(data.solution);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={styles.solutionForm}>
      <h3 style={{ marginBottom: 14, fontSize: 17 }}>Post a solution</h3>
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
      {myStartups.length > 0 && (
        <div className="field">
          <label>Post as</label>
          <select value={asStartup} onChange={(e) => setAsStartup(e.target.value)}>
            <option value="">Myself</option>
            {myStartups.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit solution"}</button>
    </form>
  );
}

function SolutionCard({ solution, canReview, token, onReviewed }) {
  const [reviews, setReviews] = useState([]);
  const [showReviews, setShowReviews] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(solution.myReview?.rating || 5);
  const [outcome, setOutcome] = useState(solution.myReview?.outcome || "solved");
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
      await api.submitReview(solution.id, { rating, outcome, feedback }, token);
      const [revData, fresh] = await Promise.all([
        api.listReviews(solution.id),
        api.getSolution(solution.id, token),
      ]);
      setReviews(revData.reviews);
      setShowForm(false);
      setShowReviews(true);
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
        <div style={{ minWidth: 0 }}>
          <h3 style={styles.solutionTitle}>{solution.title}</h3>
          <p style={styles.solutionAuthor}>
            {solution.startup ? (
              <>
                by{" "}
                <Link to={`/startups/${solution.startup.id}`} style={{ fontWeight: 600 }}>
                  {solution.startup.name}
                </Link>
                {solution.startup.claimed ? " ✓" : ""}
              </>
            ) : (
              <>built by {solution.author_name}</>
            )}
          </p>
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
            {solution.myReview ? "Edit your review" : "Did it work? Review it"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submitReview} style={styles.reviewForm}>
          {error && <div className="error-banner">{error}</div>}
          <div style={{ marginBottom: 12 }}>
            <p style={styles.reviewQuestion}>Did it solve your problem?</p>
            <div style={styles.outcomeRow}>
              {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                <label key={value} style={styles.outcomeOption}>
                  <input
                    type="radio"
                    name={`outcome-${solution.id}`}
                    checked={outcome === value}
                    onChange={() => setOutcome(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
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
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <strong style={{ fontSize: 13.5 }}>{r.author_name}</strong>
                    {r.outcome && (
                      <span
                        className="mono"
                        style={{ ...styles.outcomeChip, borderColor: OUTCOME_COLORS[r.outcome] }}
                      >
                        {OUTCOME_LABELS[r.outcome]}
                      </span>
                    )}
                  </span>
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
  problemCard: { display: "flex", gap: 24, padding: 28, marginBottom: 24 },
  badgeRow: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  category: {
    fontFamily: "var(--mono)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.5,
    color: "var(--ink)", background: "var(--paper-dim)", padding: "3px 8px", borderRadius: 2,
  },
  title: { fontSize: 26, fontWeight: 700, margin: "12px 0 8px" },
  meta: { fontSize: 13, color: "var(--text-dim)", marginBottom: 16 },
  desc: { fontSize: 15.5, lineHeight: 1.6, color: "var(--text)" },
  problemActions: { marginTop: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  commitmentsBox: {
    border: "1.5px solid var(--build)", borderRadius: 4, padding: "14px 18px",
    marginBottom: 24, background: "#fff",
  },
  commitmentsLabel: { fontSize: 10.5, letterSpacing: 1, color: "var(--build)", fontWeight: 600, marginBottom: 8 },
  commitmentRow: { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  commitmentStatus: { fontSize: 13.5, color: "var(--text)" },
  commitmentNote: { fontSize: 13, color: "var(--text-dim)", fontStyle: "italic" },
  h2: { fontSize: 20, marginBottom: 8 },
  hint: {
    fontSize: 13.5, color: "var(--text-dim)", marginBottom: 18,
    background: "var(--paper-dim)", padding: "10px 14px", borderRadius: 3, lineHeight: 1.5,
  },
  startupActions: { padding: "16px 20px", marginBottom: 28, marginTop: 8 },
  startupActionsLabel: { fontSize: 10.5, letterSpacing: 1, color: "var(--text-dim)", fontWeight: 600, marginBottom: 10 },
  startupActionsRow: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  startupSelect: {
    padding: "8px 11px", borderRadius: 3, border: "1.5px solid var(--line)",
    fontSize: 13.5, background: "#fff",
  },
  noteInput: {
    flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 3,
    border: "1.5px solid var(--line)", fontSize: 13.5,
  },
  committedNote: { fontSize: 13.5, color: "var(--text-dim)", flex: 1 },
  solutionsHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 30 },
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
  reviewQuestion: { fontSize: 13.5, fontWeight: 600, marginBottom: 8 },
  outcomeRow: { display: "flex", gap: 16, flexWrap: "wrap" },
  outcomeOption: { display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, cursor: "pointer" },
  outcomeChip: {
    fontSize: 10.5, fontWeight: 600, border: "1.5px solid", borderRadius: 2,
    padding: "1px 7px", letterSpacing: 0.3,
  },
  reviewsList: { marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 },
  reviewItem: { paddingBottom: 12, borderBottom: "1px solid var(--line)" },
  reviewHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 10, flexWrap: "wrap" },
  reviewFeedback: { fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5 },
  gallery: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 },
  galleryImage: {
    width: 132, height: 132, objectFit: "cover", borderRadius: 3,
    border: "1.5px solid var(--line)", cursor: "zoom-in", display: "block",
  },
  galleryVideo: {
    maxWidth: 280, maxHeight: 200, borderRadius: 3,
    border: "1.5px solid var(--line)", display: "block", background: "#000",
  },
  lightbox: {
    position: "fixed", inset: 0, background: "rgba(16, 20, 37, 0.85)", zIndex: 100,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out",
    padding: 32,
  },
  lightboxImg: { maxWidth: "100%", maxHeight: "100%", borderRadius: 4 },
  commentList: { display: "flex", flexDirection: "column", gap: 0, marginBottom: 16 },
  commentItem: { padding: "14px 0", borderBottom: "1px solid var(--line)" },
  commentHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 },
  commentAuthor: { display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, flexWrap: "wrap" },
  startupChip: {
    fontSize: 9.5, fontWeight: 600, letterSpacing: 0.8, color: "var(--build)",
    border: "1.5px solid var(--build)", borderRadius: 2, padding: "1px 6px",
  },
  commentVia: { fontSize: 12, color: "var(--text-dim)" },
  commentDate: { fontSize: 11.5, color: "var(--text-dim)" },
  commentHeadRight: { display: "flex", alignItems: "center", gap: 12 },
  authorLink: { fontWeight: 600, color: "var(--ink)" },
  embedWrap: { marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 },
  embedToggle: {
    background: "none", border: "none", padding: 0, cursor: "pointer",
    fontSize: 12.5, fontWeight: 600, color: "var(--build)", fontFamily: "inherit",
  },
  embedBody: { marginTop: 12 },
  embedCode: {
    width: "100%", minHeight: 66, fontFamily: "var(--mono)", fontSize: 11.5,
    padding: 10, border: "1.5px solid var(--line)", borderRadius: 3,
    background: "var(--paper-dim)", color: "var(--text)", resize: "vertical",
  },
  commentBody: { fontSize: 14, lineHeight: 1.55, color: "var(--text)", whiteSpace: "pre-wrap" },
  commentForm: { padding: 18 },
  commentFormRow: { display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center", flexWrap: "wrap" },
};
