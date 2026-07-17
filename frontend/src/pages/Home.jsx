import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import StatusBadge from "../components/StatusBadge.jsx";

export default function Home() {
  const { user } = useAuth();

  return (
    <div>
      <Hero user={user} />
      <TrendingStrip />
      <Pipeline />
      <WhyBoth />
      <FinalCta user={user} />
      <Footer />
    </div>
  );
}

/* ---------------- Trending: proof the board is alive ---------------- */
function TrendingStrip() {
  const [problems, setProblems] = useState([]);

  useEffect(() => {
    api
      .listProblems({ sort: "trending" })
      .then((d) => setProblems(d.problems.slice(0, 6)))
      .catch(() => {});
  }, []);

  if (problems.length === 0) return null;

  return (
    <section style={s.trending}>
      <div className="wrap">
        <div style={s.trendingHead}>
          <div>
            <div style={s.trendingEyebrow} className="mono">TRENDING NOW</div>
            <h2 style={s.trendingTitle}>What people are struggling with this week</h2>
          </div>
          <Link to="/problems?sort=trending" style={s.trendingAll}>
            See all problems →
          </Link>
        </div>

        <div style={s.trendingGrid}>
          {problems.map((p) => (
            <Link key={p.id} to={`/problems/${p.id}`} className="card" style={s.trendCard}>
              <div style={s.trendTop}>
                <span className="mono" style={s.trendCat}>{p.category}</span>
                <StatusBadge status={p.status} />
              </div>
              <h3 style={s.trendTitle}>{p.title}</h3>
              <div style={s.trendFoot}>
                <span className="mono" style={s.trendScore}>↑ {p.score}</span>
                <span>{p.followerCount} waiting</span>
                {p.commentCount > 0 && <span>{p.commentCount} comments</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Hero: the schematic ---------------- */
function Hero({ user }) {
  return (
    <section style={s.hero}>
      <div className="wrap" style={s.heroInner}>
        <div style={s.heroText}>
          <div style={s.eyebrow} className="mono">is there a startup for that?</div>
          <h1 style={s.h1}>
            Someone might already be
            <br />
            solving your <span style={{ color: "var(--spark)" }}>problem.</span>
          </h1>
          <p style={s.sub}>
            Describe a problem from your daily life and Solvyard matches you with startups
            already solving it. Nothing out there yet? List it, and you'll be the first to
            know when a startup commits to a fix.
          </p>
          <div style={s.ctaRow}>
            <Link to={user ? "/post" : "/register"} className="btn btn-spark">
              Describe your problem →
            </Link>
            <Link to="/startups" className="btn btn-ghost-dark">
              Browse startups
            </Link>
          </div>
        </div>

        <Schematic />
      </div>
    </section>
  );
}

function Schematic() {
  return (
    <svg viewBox="0 0 480 420" style={s.schematic} aria-hidden="true">
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--line-on-dark)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="480" height="420" fill="url(#grid)" />

      {/* crop marks */}
      {[[8,8],[472,8],[8,412],[472,412]].map(([x,y],i) => (
        <g key={i} stroke="var(--text-on-dark-dim)" strokeWidth="1.5">
          <line x1={x-6} y1={y} x2={x+6} y2={y} />
          <line x1={x} y1={y-6} x2={x} y2={y+6} />
        </g>
      ))}

      {/* Problem card */}
      <g transform="translate(24,30)">
        <rect width="168" height="92" rx="3" fill="var(--ink-soft)" stroke="var(--spark)" strokeWidth="1.5" />
        <text x="14" y="24" fill="var(--spark)" fontFamily="IBM Plex Mono" fontSize="10" letterSpacing="1">01 / PROBLEM</text>
        <text x="14" y="46" fill="var(--text-on-dark)" fontFamily="Space Grotesk" fontSize="13" fontWeight="600">"Rent splitting</text>
        <text x="14" y="63" fill="var(--text-on-dark)" fontFamily="Space Grotesk" fontSize="13" fontWeight="600">always causes</text>
        <text x="14" y="80" fill="var(--text-on-dark)" fontFamily="Space Grotesk" fontSize="13" fontWeight="600">a fight."</text>
      </g>

      {/* vote dial */}
      <g transform="translate(210,50)">
        <circle cx="0" cy="0" r="30" fill="none" stroke="var(--build)" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="0" y="-4" textAnchor="middle" fill="var(--build)" fontFamily="IBM Plex Mono" fontSize="16" fontWeight="600">+41</text>
        <text x="0" y="12" textAnchor="middle" fill="var(--text-on-dark-dim)" fontFamily="IBM Plex Mono" fontSize="8">votes</text>
      </g>

      <line x1="192" y1="76" x2="182" y2="76" stroke="var(--text-on-dark-dim)" strokeDasharray="3 3" />

      {/* arrow to matched startup */}
      <path d="M 240 50 L 300 50" stroke="var(--text-on-dark-dim)" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--text-on-dark-dim)" />
        </marker>
      </defs>

      {/* Matched startup card */}
      <g transform="translate(300,10)">
        <rect width="156" height="92" rx="3" fill="var(--ink-soft)" stroke="var(--build)" strokeWidth="1.5" />
        <text x="14" y="24" fill="var(--build)" fontFamily="IBM Plex Mono" fontSize="10" letterSpacing="1">02 / MATCH</text>
        <text x="14" y="46" fill="var(--text-on-dark)" fontFamily="Space Grotesk" fontSize="13" fontWeight="600">SplitFair</text>
        <text x="14" y="63" fill="var(--text-on-dark-dim)" fontFamily="Inter" fontSize="11">already solves</text>
        <text x="14" y="79" fill="var(--text-on-dark-dim)" fontFamily="Inter" fontSize="11">this exact pain</text>
      </g>

      {/* arrow down to review */}
      <path d="M 378 102 L 378 140" stroke="var(--text-on-dark-dim)" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" />

      {/* Review card */}
      <g transform="translate(300,150)">
        <rect width="156" height="70" rx="3" fill="var(--ink-soft)" stroke="var(--line-on-dark)" strokeWidth="1.5" />
        <text x="14" y="22" fill="var(--text-on-dark-dim)" fontFamily="IBM Plex Mono" fontSize="10" letterSpacing="1">03 / VERIFY</text>
        <text x="14" y="44" fill="var(--spark)" fontFamily="Inter" fontSize="15">★★★★★</text>
        <text x="14" y="60" fill="var(--text-on-dark-dim)" fontFamily="Inter" fontSize="10.5">"solved it" (Alice)</text>
      </g>

      {/* annotation footer */}
      <text x="24" y="400" fill="var(--text-on-dark-dim)" fontFamily="IBM Plex Mono" fontSize="10">
        FIG. 1 / PROBLEM TO STARTUP, MATCHED AND VERIFIED
      </text>
    </svg>
  );
}

/* ---------------- Pipeline (feature walkthrough) ---------------- */
function Pipeline() {
  const steps = [
    {
      n: "01",
      title: "Describe your problem",
      body: "Type the frustration the way you'd complain about it to a friend. While you write, Solvyard live-checks the startup directory for someone already solving it.",
      accent: "var(--spark)",
    },
    {
      n: "02",
      title: "Get matched, or be first",
      body: "If a startup solves it, you get it instantly: no searching, no guesswork. If nothing exists yet, list the problem and you're first in line when a fix ships.",
      accent: "var(--build)",
    },
    {
      n: "03",
      title: "The crowd adds weight",
      body: "Others with the same problem vote and follow it. Every vote is a person waiting for the fix, and startups see exactly how many people that is.",
      accent: "var(--spark)",
    },
    {
      n: "04",
      title: "Startups commit and ship",
      body: "Startups claim matching problems, commit to building, and ship. Everyone following gets notified, and only people who had the problem can review whether it actually worked.",
      accent: "var(--build)",
    },
  ];

  return (
    <section style={s.pipeline}>
      <div className="wrap">
        <h2 style={s.sectionTitle}>How Solvyard works</h2>
        <p style={s.sectionSub}>From complaint to solution, with proof at every step.</p>

        <div style={s.stepsGrid}>
          {steps.map((step) => (
            <div key={step.n} style={s.step}>
              <div className="mono" style={{ ...s.stepNum, color: step.accent }}>{step.n}</div>
              <h3 style={s.stepTitle}>{step.title}</h3>
              <p style={s.stepBody}>{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Why both sides come here ---------------- */
function WhyBoth() {
  return (
    <section style={s.why}>
      <div className="wrap" style={s.whyGrid}>
        <div style={s.whyCol}>
          <div style={s.whyEyebrow} className="mono">FOR PEOPLE WITH PROBLEMS</div>
          <h3 style={s.whyTitle}>Stop googling badly. Ask the board that knows.</h3>
          <p style={s.whyBody}>
            Every "is there an app for that" moment has a home now. Get matched with a
            startup that solves it, backed by reviews from people who had your exact
            problem. And when nothing exists yet, your listing makes sure you hear the
            moment that changes.
          </p>
        </div>
        <div style={s.whyDivider} />
        <div style={s.whyCol}>
          <div style={s.whyEyebrow} className="mono">FOR STARTUPS</div>
          <h3 style={s.whyTitle}>Meet users describing the exact pain you solve.</h3>
          <p style={s.whyBody}>
            List what you solve in plain language and Solvyard routes matching problems to
            your dashboard: real leads, in the user's own words, with vote counts that
            prove demand. Commit to an unsolved problem and everyone waiting on it becomes
            your launch audience.
          </p>
        </div>
      </div>
    </section>
  );
}

function FinalCta({ user }) {
  return (
    <section style={s.finalCta}>
      <div className="wrap" style={s.finalCtaInner}>
        <h2 style={s.finalCtaTitle}>Your problem is either solved, or about to be. Find out which.</h2>
        <div style={s.ctaRow}>
          <Link to={user ? "/post" : "/register"} className="btn btn-spark">
            Describe your problem →
          </Link>
          <Link to="/startups" className="btn btn-ghost-dark">
            List your startup
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={s.footer}>
      <div className="wrap" style={s.footerInner}>
        <span className="mono" style={{ fontSize: 12.5 }}>
          solv<span style={{ color: "var(--signal)" }}>yard</span>
        </span>
        <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
          Problems in. Products out.
        </span>
      </div>
    </footer>
  );
}

const s = {
  hero: { background: "var(--ink)", padding: "72px 0 88px" },
  heroInner: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" },
  heroText: {},
  eyebrow: { color: "var(--spark)", fontSize: 12.5, letterSpacing: 1.5, marginBottom: 18, textTransform: "uppercase" },
  h1: { fontSize: 44, lineHeight: 1.12, color: "var(--text-on-dark)", fontWeight: 700, marginBottom: 22 },
  sub: { fontSize: 16.5, lineHeight: 1.6, color: "var(--text-on-dark-dim)", maxWidth: 460, marginBottom: 32 },
  ctaRow: { display: "flex", gap: 14, flexWrap: "wrap" },
  schematic: { width: "100%", height: "auto", border: "1px solid var(--line-on-dark)", borderRadius: 4 },

  trending: { padding: "64px 0", background: "var(--paper-dim)", borderBottom: "1.5px solid var(--line)" },
  trendingHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, marginBottom: 28, flexWrap: "wrap" },
  trendingEyebrow: { fontSize: 12, letterSpacing: 1.2, color: "var(--signal)", marginBottom: 10, fontWeight: 600 },
  trendingTitle: { fontSize: 26, fontWeight: 700, lineHeight: 1.25 },
  trendingAll: { fontSize: 14, fontWeight: 600, color: "var(--text-dim)", whiteSpace: "nowrap" },
  trendingGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 },
  trendCard: { padding: 18, display: "flex", flexDirection: "column", gap: 10, background: "#fff" },
  trendTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  trendCat: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-dim)" },
  trendTitle: {
    fontSize: 15.5, fontWeight: 600, lineHeight: 1.4, flex: 1,
    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
  },
  trendFoot: { display: "flex", gap: 14, fontSize: 12, color: "var(--text-dim)", alignItems: "center" },
  trendScore: { fontWeight: 600, color: "var(--ink)" },

  pipeline: { padding: "88px 0", background: "var(--paper)" },
  sectionTitle: { fontSize: 32, fontWeight: 700, marginBottom: 10 },
  sectionSub: { fontSize: 15.5, color: "var(--text-dim)", marginBottom: 48 },
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 28 },
  step: { borderTop: "2.5px solid var(--ink)", paddingTop: 16 },
  stepNum: { fontSize: 13, fontWeight: 600, marginBottom: 10 },
  stepTitle: { fontSize: 18, fontWeight: 600, marginBottom: 10, lineHeight: 1.3 },
  stepBody: { fontSize: 14, lineHeight: 1.55, color: "var(--text-dim)" },

  why: { background: "var(--paper-dim)", padding: "80px 0", borderTop: "1.5px solid var(--line)", borderBottom: "1.5px solid var(--line)" },
  whyGrid: { display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 48 },
  whyCol: { maxWidth: 440 },
  whyDivider: { background: "var(--line)" },
  whyEyebrow: { fontSize: 12, letterSpacing: 1.2, color: "var(--text-dim)", marginBottom: 16 },
  whyTitle: { fontSize: 24, fontWeight: 600, marginBottom: 14, lineHeight: 1.3 },
  whyBody: { fontSize: 15, lineHeight: 1.6, color: "var(--text-dim)" },

  finalCta: { background: "var(--ink)", padding: "80px 0" },
  finalCtaInner: { textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 28 },
  finalCtaTitle: { fontSize: 30, fontWeight: 700, color: "var(--text-on-dark)", maxWidth: 620, lineHeight: 1.3 },

  footer: { padding: "24px 0", background: "var(--ink)", borderTop: "1px solid var(--line-on-dark)" },
  footerInner: { display: "flex", justifyContent: "space-between", color: "var(--text-on-dark)" },
};
