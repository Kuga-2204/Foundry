import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Home() {
  const { user } = useAuth();

  return (
    <div>
      <Hero user={user} />
      <Pipeline />
      <WhyBoth />
      <FinalCta user={user} />
      <Footer />
    </div>
  );
}

/* ---------------- Hero: the schematic ---------------- */
function Hero({ user }) {
  return (
    <section style={s.hero}>
      <div className="wrap" style={s.heroInner}>
        <div style={s.heroText}>
          <div style={s.eyebrow} className="mono">a marketplace for real problems</div>
          <h1 style={s.h1}>
            Someone, somewhere,
            <br />
            already has your <span style={{ color: "var(--spark)" }}>next startup.</span>
          </h1>
          <p style={s.sub}>
            Foundry is where people post the problems in their daily life they can't solve
            themselves — and where builders find validated ideas worth building, backed by the
            people who'll actually use them.
          </p>
          <div style={s.ctaRow}>
            <Link to="/problems" className="btn btn-spark">Browse problems →</Link>
            <Link to={user ? "/post" : "/register"} className="btn btn-ghost-dark">
              Post a problem
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

      {/* arrow to solution */}
      <path d="M 240 50 L 300 50" stroke="var(--text-on-dark-dim)" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--text-on-dark-dim)" />
        </marker>
      </defs>

      {/* Solution card */}
      <g transform="translate(300,10)">
        <rect width="156" height="92" rx="3" fill="var(--ink-soft)" stroke="var(--build)" strokeWidth="1.5" />
        <text x="14" y="24" fill="var(--build)" fontFamily="IBM Plex Mono" fontSize="10" letterSpacing="1">02 / BUILD</text>
        <text x="14" y="46" fill="var(--text-on-dark)" fontFamily="Space Grotesk" fontSize="13" fontWeight="600">SplitFair</text>
        <text x="14" y="63" fill="var(--text-on-dark-dim)" fontFamily="Inter" fontSize="11">auto-splits bills</text>
        <text x="14" y="79" fill="var(--text-on-dark-dim)" fontFamily="Inter" fontSize="11">by usage</text>
      </g>

      {/* arrow down to review */}
      <path d="M 378 102 L 378 140" stroke="var(--text-on-dark-dim)" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" />

      {/* Review card */}
      <g transform="translate(300,150)">
        <rect width="156" height="70" rx="3" fill="var(--ink-soft)" stroke="var(--line-on-dark)" strokeWidth="1.5" />
        <text x="14" y="22" fill="var(--text-on-dark-dim)" fontFamily="IBM Plex Mono" fontSize="10" letterSpacing="1">03 / REVIEW</text>
        <text x="14" y="44" fill="var(--spark)" fontFamily="Inter" fontSize="15">★★★★★</text>
        <text x="14" y="60" fill="var(--text-on-dark-dim)" fontFamily="Inter" fontSize="10.5">"solved it" — Alice</text>
      </g>

      {/* annotation footer */}
      <text x="24" y="400" fill="var(--text-on-dark-dim)" fontFamily="IBM Plex Mono" fontSize="10">
        FIG. 1 — PROBLEM TO PRODUCT, VALIDATED AT EVERY STEP
      </text>
    </svg>
  );
}

/* ---------------- Pipeline (feature walkthrough) ---------------- */
function Pipeline() {
  const steps = [
    {
      n: "01",
      title: "Post the problem",
      body: "Have a daily frustration or an idea you can't build yourself? Post it — title, description, category. No pitch deck required, just the real problem.",
      accent: "var(--spark)",
    },
    {
      n: "02",
      title: "The crowd validates it",
      body: "Anyone who shares the problem upvotes it. Irrelevant ideas get downvoted. The score is a live signal of real demand — the best problems rise to the top of the feed.",
      accent: "var(--build)",
    },
    {
      n: "03",
      title: "Builders provide a solution",
      body: "Someone with the skills and time builds it — and posts their product as a solution directly on the original problem thread, for everyone tracking it to see.",
      accent: "var(--spark)",
    },
    {
      n: "04",
      title: "Stakeholders view & approve",
      body: "Only people who posted or voted on the problem can review a solution — a star rating plus written feedback. No drive-by reviews, only signal from people who actually had the problem.",
      accent: "var(--build)",
    },
  ];

  return (
    <section style={s.pipeline}>
      <div className="wrap">
        <h2 style={s.sectionTitle}>How Foundry works</h2>
        <p style={s.sectionSub}>Four stages. Every problem moves through them in order.</p>

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
          <div style={s.whyEyebrow} className="mono">FOR PROBLEM-POSTERS</div>
          <h3 style={s.whyTitle}>You don't need to be technical to start a startup.</h3>
          <p style={s.whyBody}>
            You just need the problem. Post it, gather upvotes from people who feel the same
            pain, and wait for a builder to pick it up. When they do, you get first look — and a
            say in whether it's actually good.
          </p>
        </div>
        <div style={s.whyDivider} />
        <div style={s.whyCol}>
          <div style={s.whyEyebrow} className="mono">FOR BUILDERS</div>
          <h3 style={s.whyTitle}>Stop guessing what to build.</h3>
          <p style={s.whyBody}>
            Every problem on Foundry comes with a vote count — real, standing demand from people
            who'd use the fix. Sort by top-voted, unsolved problems and build with a built-in
            first audience.
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
        <h2 style={s.finalCtaTitle}>The next problem worth solving is already posted.</h2>
        <div style={s.ctaRow}>
          <Link to="/problems" className="btn btn-spark">Browse problems →</Link>
          <Link to={user ? "/post" : "/register"} className="btn btn-ghost-dark">
            Post yours
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
        <span className="mono" style={{ fontSize: 12.5 }}>◆ Foundry</span>
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
