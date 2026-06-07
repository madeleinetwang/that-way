import React, { useState, useEffect } from 'react';

export default function LocationStep({ onLocationFound }) {
  const [status, setStatus] = useState('requesting'); // requesting | found | error

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus('found');
        setTimeout(() => {
          onLocationFound(pos.coords.longitude, pos.coords.latitude);
        }, 800);
      },
      () => {
        setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="overlay-bottom">
      <div className="overlay-card">
        {status === 'requesting' && (
          <>
            <div className="pulse-ring" />
            <h2 className="card-title">Finding your location</h2>
            <p className="card-body">Allow location access to continue.</p>
          </>
        )}
        {status === 'found' && (
          <>
            <div className="status-icon status-icon--success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="card-title">Location found</h2>
            <p className="card-body">Zooming to your position…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="status-icon status-icon--error">!</div>
            <h2 className="card-title">Location unavailable</h2>
            <p className="card-body">
              Permission was denied or geolocation isn't supported. Using a demo location.
            </p>
            <button
              className="btn btn--primary"
              onClick={() => {
                // Use San Francisco as demo fallback
                onLocationFound(-122.4194, 37.7749);
              }}
            >
              Continue with demo location
            </button>
          </>
        )}
      </div>
    </div>
  );
}
