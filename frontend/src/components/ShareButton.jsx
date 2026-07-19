import { useEffect, useRef, useState } from "react";

// Share a problem outward. On phones the OS share sheet (Web Share API) is
// the natural path; on desktop, where that mostly doesn't exist, we fall
// back to a small menu of the platforms people actually forward links on,
// plus copy-to-clipboard. Sharing turns every poster into distribution:
// the person with the problem recruits others who have it too.
export default function ShareButton({ problem, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  const url = `${window.location.origin}/problems/${problem.id}`;
  const text = `"${problem.title}" — is there a startup solving this? Weigh in on Solvyard:`;
  // Invite framing: aimed at someone who shares the pain, to recruit a vote.
  const inviteText = `Do you have this problem too? "${problem.title}" — add your vote on Solvyard so startups see the demand:`;

  // Close the fallback menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleClick = async () => {
    // Prefer the native sheet where it exists (almost always mobile).
    if (navigator.share) {
      try {
        await navigator.share({ title: problem.title, text, url });
        return;
      } catch {
        // user dismissed the sheet, or it failed; fall through to the menu
      }
    }
    setOpen((v) => !v);
  };

  // Invite path: native sheet with invite copy on mobile, WhatsApp on desktop.
  const invite = async () => {
    setOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({ title: problem.title, text: inviteText, url });
        return;
      } catch {
        /* dismissed */
      }
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(inviteText)}%20${encodeURIComponent(url)}`,
      "_blank",
      "noopener"
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked; leave the menu open so the user can copy manually
    }
  };

  const encoded = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const targets = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodedText}%20${encoded}` },
    { label: "X / Twitter", href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encoded}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}` },
  ];

  return (
    <div style={styles.wrap} ref={ref}>
      <button className={`btn btn-${size}`} onClick={handleClick} aria-haspopup="menu" aria-expanded={open}>
        Share
      </button>

      {open && (
        <div style={styles.menu} role="menu">
          <button style={styles.invite} role="menuitem" onClick={invite}>
            Invite someone who has this too
          </button>
          <div style={styles.divider} />
          {targets.map((t) => (
            <a
              key={t.label}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.item}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {t.label}
            </a>
          ))}
          <button style={styles.item} role="menuitem" onClick={copyLink}>
            {copied ? "Link copied ✓" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { position: "relative", display: "inline-block" },
  menu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    zIndex: 60,
    minWidth: 170,
    background: "#fff",
    border: "1.5px solid var(--line)",
    borderRadius: 4,
    boxShadow: "0 6px 20px rgba(16, 20, 37, 0.12)",
    padding: 5,
    display: "flex",
    flexDirection: "column",
  },
  item: {
    textAlign: "left",
    background: "none",
    border: "none",
    padding: "9px 12px",
    fontSize: 13.5,
    color: "var(--text)",
    cursor: "pointer",
    borderRadius: 3,
    fontFamily: "inherit",
    width: "100%",
    display: "block",
  },
  invite: {
    textAlign: "left",
    background: "none",
    border: "none",
    padding: "9px 12px",
    fontSize: 13.5,
    fontWeight: 600,
    color: "var(--build)",
    cursor: "pointer",
    borderRadius: 3,
    fontFamily: "inherit",
    width: "100%",
    display: "block",
  },
  divider: { height: 1, background: "var(--line)", margin: "4px 6px" },
};
