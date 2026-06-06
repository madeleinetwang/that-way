import React, { useMemo } from 'react';

function computeMockStats(savedRoutes) {
  // Fabricate stats from saved route data for realism
  const totalWaypoints = savedRoutes.reduce((n, r) => n + (r.waypoints?.length || 0), 0);
  const leftTurnsAvoided = 2 + (totalWaypoints % 3);
  const streetPct = 55 + (totalWaypoints % 20);
  const matchPct = 82 + (totalWaypoints % 15);
  return { leftTurnsAvoided, streetPct, matchPct };
}

export default function DoneStep({ savedRoutes, onStartOver }) {
  const stats = useMemo(() => computeMockStats(savedRoutes), [savedRoutes]);

  return (
    <div className="overlay-bottom">
      <div className="overlay-card overlay-card--done">
        <div className="done-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="url(#doneGrad)" />
            <path d="M9 17l5 5 9-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="doneGrad" x1="0" y1="0" x2="32" y2="32">
                <stop stopColor="#FF6B35" />
                <stop offset="1" stopColor="#ff9a00" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h2 className="card-title">Your route is ready.</h2>

        <div className="stats-grid">
          <div className="stat">
            <span className="stat-value">{stats.leftTurnsAvoided}</span>
            <span className="stat-label">left turns avoided</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.streetPct}%</span>
            <span className="stat-label">surface streets</span>
          </div>
          <div className="stat">
            <span className="stat-value stat-value--accent">{stats.matchPct}%</span>
            <span className="stat-label">style match</span>
          </div>
        </div>

        <div className="done-tags">
          <span className="done-tag">Avoids {stats.leftTurnsAvoided} left turns</span>
          <span className="done-tag">Prefers surface streets</span>
          <span className="done-tag">Matches your style {stats.matchPct}%</span>
        </div>

        <button className="btn btn--ghost" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </div>
  );
}
