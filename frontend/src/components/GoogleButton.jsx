import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GSI_SRC = "https://accounts.google.com/gsi/client";

// "Sign in with Google" via Google Identity Services. Renders nothing unless
// VITE_GOOGLE_CLIENT_ID is set, so the app stays clean until Google is
// configured. On success we hand the ID token to the backend, which verifies
// it and returns our own session token.
export default function GoogleButton({ onDone, onError }) {
  const ref = useRef(null);
  const { setSession } = useAuth();
  const [ready, setReady] = useState(!!window.google?.accounts?.id);

  // Load Google's script once.
  useEffect(() => {
    if (!CLIENT_ID || window.google?.accounts?.id) {
      if (window.google?.accounts?.id) setReady(true);
      return;
    }
    let script = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    const onLoad = () => setReady(true);
    script.addEventListener("load", onLoad);
    return () => script.removeEventListener("load", onLoad);
  }, []);

  useEffect(() => {
    if (!CLIENT_ID || !ready || !ref.current) return;
    const handle = async (response) => {
      try {
        const data = await api.googleLogin(response.credential);
        setSession(data.token, data.user);
        onDone?.(data.user);
      } catch (err) {
        onError?.(err.message);
      }
    };
    window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handle });
    window.google.accounts.id.renderButton(ref.current, {
      theme: "outline",
      size: "large",
      width: 320,
      text: "continue_with",
    });
  }, [ready, onDone, onError, setSession]);

  if (!CLIENT_ID) return null;

  return (
    <div style={styles.wrap}>
      <div ref={ref} />
      <div style={styles.divider}>
        <span style={styles.line} />
        <span style={styles.or}>or</span>
        <span style={styles.line} />
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 8 },
  divider: { display: "flex", alignItems: "center", gap: 10, width: "100%", margin: "18px 0 6px" },
  line: { flex: 1, height: 1, background: "var(--line)" },
  or: { fontSize: 12, color: "var(--text-dim)" },
};
