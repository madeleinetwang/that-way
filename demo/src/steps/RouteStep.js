import React, { useState, useRef, useEffect, useCallback } from 'react';
import { suggest } from '../geocode';

const CHIPS = ['Work', 'School', 'Gym', 'Grocery Store'];
const ROUTE_COLORS = ['#4facfe', '#a78bfa', '#34d399'];

export default function RouteStep({
  routeIndex,
  totalRoutes,
  userLocation,
  savedRoutes,
  mapRef,
  onRouteSaved,
}) {
  const [phase, setPhase] = useState('pick'); // pick | loading | adjust
  const [selectedChip, setSelectedChip] = useState(null); // only the label
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchError, setSearchError] = useState(false);
  const labelRef = useRef('');
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // ── live suggestions ────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(async (q) => {
    const results = await suggest(q, userLocation);
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
    setActiveIndex(-1);
  }, [userLocation]);

  const handleQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setSearchError(false);
    setActiveIndex(-1);

    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 280);
  };

  // ── keyboard navigation ─────────────────────────────────────────────────

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

  // ── select a suggestion and start the route ─────────────────────────────

  const selectSuggestion = async (result) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setQuery(result.placeName);
    labelRef.current = selectedChip || result.placeName.split(',')[0];
    setPhase('loading');
    await mapRef.current.startRouteCapture(result.lng, result.lat);
    setPhase('adjust');
  };

  // ── close dropdown on outside click ────────────────────────────────────

  useEffect(() => {
    const onClickOutside = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // ── save route and reset ────────────────────────────────────────────────

  const handleSave = () => {
    const saved = mapRef.current.getSavedRoute();
    onRouteSaved({ label: labelRef.current, ...saved });
    mapRef.current.clearRoute();
    setPhase('pick');
    setSelectedChip(null);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];

  return (
    <>
      {savedRoutes.length > 0 && (
        <div className="route-sidebar">
          <p className="sidebar-label">Saved routes</p>
          {savedRoutes.map((r, i) => (
            <div key={i} className="sidebar-route">
              <span
                className="sidebar-dot"
                style={{ background: ROUTE_COLORS[i % ROUTE_COLORS.length] }}
              />
              <span className="sidebar-route-name">{r.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="overlay-bottom">
        <div className="overlay-card">
          <div className="progress-row">
            <span className="progress-label">Route {routeIndex + 1} of {totalRoutes}</span>
            <div className="progress-dots">
              {Array.from({ length: totalRoutes }).map((_, i) => (
                <span
                  key={i}
                  className={`progress-dot ${i < routeIndex ? 'done' : ''} ${i === routeIndex ? 'active' : ''}`}
                  style={i === routeIndex ? { background: color } : {}}
                />
              ))}
            </div>
          </div>

          {phase === 'pick' && (
            <>
              <h2 className="card-title">Where do you go often?</h2>

              {/* Chips set the route label only */}
              <div className="chip-row">
                {CHIPS.map((chip) => (
                  <button
                    key={chip}
                    className={`chip ${selectedChip === chip ? 'chip--active' : ''}`}
                    style={selectedChip === chip ? { borderColor: color, color } : {}}
                    onClick={() => {
                      setSelectedChip((prev) => (prev === chip ? null : chip));
                      inputRef.current?.focus();
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Autocomplete search box */}
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
                    placeholder={
                      selectedChip
                        ? `Search for your ${selectedChip.toLowerCase()}…`
                        : 'Search for a place or address…'
                    }
                    value={query}
                    onChange={handleQueryChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {query && (
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

              {searchError && (
                <p className="error-text">No results found. Try a different search.</p>
              )}
            </>
          )}

          {phase === 'loading' && (
            <div className="loading-inline">
              <div className="spinner" style={{ borderTopColor: color }} />
              <p className="card-body">Calculating route…</p>
            </div>
          )}

          {phase === 'adjust' && (
            <>
              <h2 className="card-title">Adjust your route</h2>
              <p className="card-body">
                Click anywhere on the <span className="highlight">blue route</span> and drag it onto the streets you actually take. It'll snap to the nearest road.
              </p>
              <button
                className="btn btn--primary"
                style={{ background: color, borderColor: color }}
                onClick={handleSave}
              >
                Save Route
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
