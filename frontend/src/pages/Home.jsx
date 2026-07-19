import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
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
  const isMobile = useMediaQuery("(max-width: 860px)");
  return (
    <section style={s.hero}>
      <div className="wrap" style={{ ...s.heroInner, ...(isMobile ? s.heroInnerMobile : null) }}>
        <div style={s.heroText}>
          <div style={s.eyebrow} className="mono">is there a startup for that?</div>
          <h1 style={{ ...s.h1, ...(isMobile ? s.h1Mobile : null) }}>
            Someone might already be solving your{" "}
            <span style={{ color: "var(--spark)" }}>problem.</span>
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

        {/* The schematic is decorative; drop it on phones to save vertical
            space and keep the hero focused on the headline + CTAs. */}
        {!isMobile && <Schematic />}
      </div>
    </section>
  );
}

function Schematic() {
  return (
    <svg viewBox="0 0 520 440" style={s.schematic} aria-hidden="true">
      <defs>
        <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
          <path d="M 26 0 L 0 0 0 26" fill="none" stroke="var(--line-on-dark)" strokeWidth="1" />
        </pattern>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
          <path d="M0,0 L9,5 L0,10 z" fill="var(--text-on-dark-dim)" />
        </marker>
      </defs>
      <rect width="520" height="440" fill="url(#grid)" />

      {/* crop marks */}
      {[[24, 24], [496, 24], [24, 416], [496, 416]].map(([x, y], i) => (
        <g key={i} stroke="var(--text-on-dark-dim)" strokeWidth="1.5">
          <line x1={x - 7} y1={y} x2={x + 7} y2={y} />
          <line x1={x} y1={y - 7} x2={x} y2={y + 7} />
        </g>
      ))}

      {/* connectors, under the cards */}
      <path d="M 212 124 L 231 124" stroke="var(--text-on-dark-dim)" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M 289 124 L 308 124" stroke="var(--text-on-dark-dim)" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" />
      <path d="M 126 196 L 126 247" stroke="var(--text-on-dark-dim)" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" />
      <path d="M 394 196 L 394 247" stroke="var(--text-on-dark-dim)" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" />

      {/* 01 PROBLEM — top left */}
      <g transform="translate(40,52)">
        <rect width="172" height="144" rx="6" fill="var(--ink-soft)" stroke="var(--spark)" strokeWidth="1.5" />
        <rect x="16" y="15" width="28" height="20" rx="4" fill="var(--spark)" />
        <text x="30" y="29.5" textAnchor="middle" fill="var(--ink)" fontFamily="IBM Plex Mono" fontSize="11" fontWeight="700">01</text>
        <text x="52" y="29" fill="var(--spark)" fontFamily="IBM Plex Mono" fontSize="11" letterSpacing="1.5">PROBLEM</text>
        <line x1="16" y1="47" x2="156" y2="47" stroke="var(--spark)" strokeOpacity="0.22" strokeWidth="1" />
        <text x="16" y="76" fill="var(--text-on-dark)" fontFamily="Space Grotesk" fontSize="15.5" fontWeight="600">"Rent splitting</text>
        <text x="16" y="99" fill="var(--text-on-dark)" fontFamily="Space Grotesk" fontSize="15.5" fontWeight="600">always causes</text>
        <text x="16" y="122" fill="var(--text-on-dark)" fontFamily="Space Grotesk" fontSize="15.5" fontWeight="600">a fight."</text>
      </g>

      {/* vote dial, on the problem to match connector */}
      <g transform="translate(260,124)">
        <circle cx="0" cy="0" r="28" fill="var(--ink)" stroke="var(--build)" strokeWidth="1.5" strokeDasharray="3.5 3" />
        <text x="0" y="-2" textAnchor="middle" fill="var(--build)" fontFamily="IBM Plex Mono" fontSize="16" fontWeight="700">+41</text>
        <text x="0" y="13" textAnchor="middle" fill="var(--text-on-dark-dim)" fontFamily="IBM Plex Mono" fontSize="7.5" letterSpacing="1.5">VOTES</text>
      </g>

      {/* 02 MATCH — top right */}
      <g transform="translate(308,52)">
        <rect width="172" height="144" rx="6" fill="var(--ink-soft)" stroke="var(--build)" strokeWidth="1.5" />
        <rect x="16" y="15" width="28" height="20" rx="4" fill="var(--build)" />
        <text x="30" y="29.5" textAnchor="middle" fill="var(--ink)" fontFamily="IBM Plex Mono" fontSize="11" fontWeight="700">02</text>
        <text x="52" y="29" fill="var(--build)" fontFamily="IBM Plex Mono" fontSize="11" letterSpacing="1.5">MATCH</text>
        <line x1="16" y1="47" x2="156" y2="47" stroke="var(--build)" strokeOpacity="0.22" strokeWidth="1" />
        <text x="16" y="80" fill="var(--text-on-dark)" fontFamily="Space Grotesk" fontSize="18" fontWeight="700">SplitFair</text>
        <text x="16" y="105" fill="var(--text-on-dark-dim)" fontFamily="Inter" fontSize="12">already solves</text>
        <text x="16" y="124" fill="var(--text-on-dark-dim)" fontFamily="Inter" fontSize="12">this exact pain</text>
      </g>

      {/* PEOPLE WAITING — bottom left, balances the composition */}
      <g transform="translate(40,250)">
        <rect width="172" height="118" rx="6" fill="var(--ink-soft)" stroke="var(--signal)" strokeWidth="1.5" />
        <text x="16" y="29" fill="var(--signal)" fontFamily="IBM Plex Mono" fontSize="11" letterSpacing="1.2">PEOPLE WAITING</text>
        <line x1="16" y1="43" x2="156" y2="43" stroke="var(--signal)" strokeOpacity="0.22" strokeWidth="1" />
        {[
          ["var(--spark)", 30, "R"],
          ["var(--build)", 49, "M"],
          ["var(--signal)", 68, "K"],
        ].map(([fill, cx, ch], i) => (
          <g key={i}>
            <circle cx={cx} cy="74" r="13" fill={fill} stroke="var(--ink-soft)" strokeWidth="3" />
            <text x={cx} y="78" textAnchor="middle" fill="var(--ink)" fontFamily="Space Grotesk" fontSize="11" fontWeight="700">{ch}</text>
          </g>
        ))}
        <circle cx="87" cy="74" r="13" fill="none" stroke="var(--text-on-dark-dim)" strokeWidth="1.5" strokeDasharray="2.5 2" />
        <text x="87" y="77.5" textAnchor="middle" fill="var(--text-on-dark-dim)" fontFamily="IBM Plex Mono" fontSize="8.5" fontWeight="600">+38</text>
        <text x="16" y="104" fill="var(--text-on-dark-dim)" fontFamily="Inter" fontSize="10.5">all pinged when it ships</text>
      </g>

      {/* 03 VERIFY — bottom right */}
      <g transform="translate(308,250)">
        <rect width="172" height="118" rx="6" fill="var(--ink-soft)" stroke="var(--text-on-dark-dim)" strokeOpacity="0.5" strokeWidth="1.5" />
        <rect x="16" y="15" width="28" height="20" rx="4" fill="var(--text-on-dark-dim)" />
        <text x="30" y="29.5" textAnchor="middle" fill="var(--ink)" fontFamily="IBM Plex Mono" fontSize="11" fontWeight="700">03</text>
        <text x="52" y="29" fill="var(--text-on-dark-dim)" fontFamily="IBM Plex Mono" fontSize="11" letterSpacing="1.5">VERIFY</text>
        <line x1="16" y1="47" x2="156" y2="47" stroke="var(--text-on-dark-dim)" strokeOpacity="0.22" strokeWidth="1" />
        <text x="16" y="79" fill="var(--spark)" fontFamily="Inter" fontSize="17" letterSpacing="3">★★★★★</text>
        <text x="16" y="104" fill="var(--text-on-dark-dim)" fontFamily="Inter" fontSize="11.5">"solved it" — Alice</text>
      </g>

      {/* annotation footer */}
      <text x="40" y="410" fill="var(--text-on-dark-dim)" fontFamily="IBM Plex Mono" fontSize="9.5" letterSpacing="0.5">
        FIG. 1 / PROBLEM → STARTUP, MATCHED &amp; VERIFIED
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
  const isMobile = useMediaQuery("(max-width: 760px)");
  return (
    <section style={s.why}>
      <div className="wrap" style={{ ...s.whyGrid, ...(isMobile ? s.whyGridMobile : null) }}>
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
        {!isMobile && <div style={s.whyDivider} />}
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
          solv<span style={{ color: "var(--spark)" }}>yard</span>
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
  heroInnerMobile: { gridTemplateColumns: "1fr", gap: 0, padding: "0" },
  h1Mobile: { fontSize: 34 },
  heroText: {},
  eyebrow: { color: "var(--spark)", fontSize: 12.5, letterSpacing: 1.5, marginBottom: 18, textTransform: "uppercase" },
  h1: {
    fontSize: 42,
    lineHeight: 1.14,
    color: "var(--text-on-dark)",
    fontWeight: 700,
    marginBottom: 22,
    letterSpacing: "-0.015em",
    textWrap: "balance",
    maxWidth: 520,
  },
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
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 28 },
  step: { borderTop: "2.5px solid var(--ink)", paddingTop: 16 },
  stepNum: { fontSize: 13, fontWeight: 600, marginBottom: 10 },
  stepTitle: { fontSize: 18, fontWeight: 600, marginBottom: 10, lineHeight: 1.3 },
  stepBody: { fontSize: 14, lineHeight: 1.55, color: "var(--text-dim)" },

  why: { background: "var(--paper-dim)", padding: "80px 0", borderTop: "1.5px solid var(--line)", borderBottom: "1.5px solid var(--line)" },
  whyGrid: { display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 48 },
  whyGridMobile: { gridTemplateColumns: "1fr", gap: 32 },
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
