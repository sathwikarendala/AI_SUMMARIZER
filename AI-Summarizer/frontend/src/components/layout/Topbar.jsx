export default function Topbar({ title, subtitle, modelBadge, onHamburgerClick }) {
  return (
    <div className="topbar">
      <div className="topbar-title">
        <button className="hamburger" onClick={onHamburgerClick} aria-label="Toggle sidebar" aria-expanded="false">
          <span /><span /><span />
        </button>
        <span>{title}</span>
        <span>{subtitle}</span>
      </div>
      <div className="topbar-actions">
        <span className="model-badge">{modelBadge || '🤖 NLP Active'}</span>
      </div>
    </div>
  );
}
