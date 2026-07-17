import { Link } from "react-router-dom";
import { StarsDisplay } from "./Stars.jsx";

// Compact startup card used in the directory, match panels, and dashboards.
export default function StartupCard({ startup, matched = false }) {
  return (
    <div className="card" style={{ ...styles.card, ...(matched ? styles.matchedCard : {}) }}>
      <div style={styles.top}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.nameRow}>
            <Link to={`/startups/${startup.id}`} style={styles.name}>{startup.name}</Link>
            {startup.claimed ? (
              <span className="mono" style={styles.claimedBadge}>✓ On Solvyard</span>
            ) : (
              <span className="mono" style={styles.unclaimedBadge}>Unclaimed</span>
            )}
          </div>
          <p style={styles.tagline}>{startup.tagline}</p>
        </div>
        {startup.reviewCount > 0 && (
          <StarsDisplay value={startup.avgRating} count={startup.reviewCount} />
        )}
      </div>

      <div style={styles.footer}>
        <span className="mono" style={styles.category}>{startup.category}</span>
        {matched && startup.matchedTerms?.length > 0 && (
          <span style={styles.matchTerms}>
            matches: {startup.matchedTerms.slice(0, 4).join(", ")}
          </span>
        )}
        {startup.website && (
          <a href={startup.website} target="_blank" rel="noopener noreferrer" style={styles.site}>
            Visit site ↗
          </a>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: { padding: 18, marginBottom: 12 },
  matchedCard: { borderColor: "var(--build)" },
  top: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  nameRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 },
  name: { fontFamily: "var(--display)", fontSize: 17, fontWeight: 600 },
  claimedBadge: {
    fontSize: 10.5, fontWeight: 600, color: "var(--ink)", background: "var(--build)",
    padding: "2px 7px", borderRadius: 2, letterSpacing: 0.4,
  },
  unclaimedBadge: {
    fontSize: 10.5, fontWeight: 600, color: "var(--text-dim)", border: "1px solid var(--line)",
    padding: "2px 7px", borderRadius: 2, letterSpacing: 0.4,
  },
  tagline: { fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.45 },
  footer: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" },
  category: {
    fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5,
    color: "var(--ink)", background: "var(--paper-dim)", padding: "3px 8px", borderRadius: 2,
  },
  matchTerms: { fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" },
  site: { fontSize: 12.5, fontWeight: 600, color: "var(--build)", marginLeft: "auto" },
};
