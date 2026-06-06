import React, { useState, useEffect } from 'react';

const MESSAGES = [
  'Analyzing your route patterns…',
  'Identifying preferred streets…',
  'Mapping turn preferences…',
  'Learning your driving style…',
  'Finalizing your profile…',
];

export default function LearningStep({ savedRoutes, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const total = 3500; // ms
    const interval = 60;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += interval;
      const pct = Math.min((elapsed / total) * 100, 100);
      setProgress(pct);

      const newMsg = Math.floor((pct / 100) * (MESSAGES.length - 1));
      setMsgIndex(newMsg);

      if (pct >= 100) {
        clearInterval(timer);
        setTimeout(onComplete, 400);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="overlay-full">
      <div className="learning-content">
        <div className="learning-spinner-ring" />
        <h2 className="learning-title">Learning your driving patterns</h2>
        <p className="learning-message">{MESSAGES[msgIndex]}</p>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="progress-pct">{Math.round(progress)}%</p>
        {savedRoutes.length > 0 && (
          <div className="learning-routes">
            {savedRoutes.map((r, i) => (
              <span key={i} className="learning-route-tag">{r.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
