export default function LoadingScreen({ label = "Searching Solvyard" }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite" aria-label={label}>
      <div className="loading-mark" aria-hidden="true">
        <span className="loading-ring" />
        <img src="/solvyard-loader-logo.jpeg" alt="" className="loading-logo" />
      </div>
      <p className="loading-label">{label}</p>
    </div>
  );
}
