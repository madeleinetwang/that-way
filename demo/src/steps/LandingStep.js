import React from 'react';

export default function LandingStep({ onBegin }) {
  return (
    <div className="overlay-center">
      <div className="overlay-card overlay-card--landing">
        <div className="landing-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="20" fill="url(#grad)" />
            <path d="M20 10 L28 26 L20 22 L12 26 Z" fill="white" />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4facfe" />
                <stop offset="1" stopColor="#00f2fe" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="landing-title">ThatWay</h1>
        <p className="landing-subtitle">
          Navigation that learns how you actually drive.
        </p>
        <button className="btn btn--primary btn--lg" onClick={onBegin}>
          Begin
        </button>
      </div>
    </div>
  );
}
