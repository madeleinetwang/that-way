import React, { useState, useRef, useEffect, useCallback } from 'react';
import { suggest } from '../geocode';

export default function DestinationStep({ userLocation, mapRef, onRouteReady }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [routeShown, setRouteShown] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const fetchSuggestions = useCallback(async (q) => {
    const results = await suggest(q, userLocation);
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
    setActiveIndex(-1);
  }, [userLocation]);

  const handleQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setActiveIndex(-1);
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 280);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = async (result) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setQuery(result.placeName);
    setLoading(true);
    await mapRef.current.showDestinationRoute(result.lng, result.lat);
    setLoading(false);
    setRouteShown(true);
  };

  useEffect(() => {
    const onClickOutside = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="overlay-bottom">
      <div className="overlay-card">
        {!routeShown ? (
          <>
            <h2 className="card-title">Where would you like to go?</h2>
            <p className="card-body">We'll personalize the route to your driving style.</p>

            <div className="search-autocomplete">
              <div className="search-input-wrap">
                <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  ref={inputRef}
                  className="text-input text-input--search-ac"
                  type="text"
                  placeholder="Search for a destination…"
                  value={query}
                  onChange={handleQueryChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  disabled={loading}
                />
                {loading && <span className="btn-spinner search-spinner" />}
                {!loading && query && (
                  <button
                    className="search-clear"
                    onClick={() => {
                      setQuery('');
                      setSuggestions([]);
                      setShowSuggestions(false);
                      inputRef.current?.focus();
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <ul className="suggestions-list" ref={suggestionsRef}>
                  {suggestions.map((s, i) => {
                    const [primary, ...rest] = s.placeName.split(',');
                    return (
                      <li
                        key={i}
                        className={`suggestion-item ${i === activeIndex ? 'suggestion-item--active' : ''}`}
                        onMouseDown={() => selectSuggestion(s)}
                      >
                        <span className="suggestion-pin">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" />
                          </svg>
                        </span>
                        <span className="suggestion-text">
                          <span className="suggestion-primary">{primary}</span>
                          {rest.length > 0 && (
                            <span className="suggestion-secondary">{rest.join(',').trim()}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="personalized-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#FF6B35" />
              </svg>
              Personalized for your driving style
            </div>
            <h2 className="card-title">Route ready</h2>
            <p className="card-body">
              Your route uses <span className="highlight">surface streets</span> and avoids your least preferred turns.
            </p>
            <button className="btn btn--primary btn--orange" onClick={onRouteReady}>
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
