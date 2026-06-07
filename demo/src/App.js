import React, { useRef, useState, useCallback } from 'react';
import './App.css';
import MapView from './MapView';
import LandingStep from './steps/LandingStep';
import LocationStep from './steps/LocationStep';
import RouteStep from './steps/RouteStep';
import LearningStep from './steps/LearningStep';
import DestinationStep from './steps/DestinationStep';
import DoneStep from './steps/DoneStep';

const TOTAL_ROUTES = 3;

// steps: landing | location | route | learning | destination | done
export default function App() {
  const mapRef = useRef(null);
  const [step, setStep] = useState('landing');
  const [userLocation, setUserLocation] = useState(null);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [routeIndex, setRouteIndex] = useState(0);

  const handleBegin = useCallback(() => {
    setStep('location');
  }, []);

  const handleLocationFound = useCallback((lng, lat) => {
    const loc = { lng, lat };
    setUserLocation(loc);
    mapRef.current?.setUserLocation(lng, lat);
    setTimeout(() => setStep('route'), 1800);
  }, []);

  const handleRouteSaved = useCallback((route) => {
    setSavedRoutes((prev) => {
      const next = [...prev, route];
      if (next.length >= TOTAL_ROUTES) {
        setTimeout(() => setStep('learning'), 400);
      } else {
        setRouteIndex(next.length);
      }
      return next;
    });
  }, []);

  const handleLearningComplete = useCallback(() => {
    setStep('destination');
  }, []);

  const handleRouteReady = useCallback(() => {
    setStep('done');
  }, []);

  const handleStartOver = useCallback(() => {
    mapRef.current?.clearAll();
    setSavedRoutes([]);
    setRouteIndex(0);
    setUserLocation(null);
    setStep('landing');
  }, []);

  return (
    <div className="app">
      <MapView ref={mapRef} />

      <div className={`step-layer ${step === 'landing' ? 'step-layer--visible' : 'step-layer--hidden'}`}>
        <LandingStep onBegin={handleBegin} />
      </div>

      {step === 'location' && (
        <div className="step-layer step-layer--visible">
          <LocationStep onLocationFound={handleLocationFound} />
        </div>
      )}

      {step === 'route' && (
        <div className="step-layer step-layer--visible">
          <RouteStep
            routeIndex={routeIndex}
            totalRoutes={TOTAL_ROUTES}
            userLocation={userLocation}
            savedRoutes={savedRoutes}
            mapRef={mapRef}
            onRouteSaved={handleRouteSaved}
          />
        </div>
      )}

      {step === 'learning' && (
        <div className="step-layer step-layer--visible">
          <LearningStep savedRoutes={savedRoutes} onComplete={handleLearningComplete} />
        </div>
      )}

      {step === 'destination' && (
        <div className="step-layer step-layer--visible">
          <DestinationStep
            userLocation={userLocation}
            mapRef={mapRef}
            onRouteReady={handleRouteReady}
          />
        </div>
      )}

      {step === 'done' && (
        <div className="step-layer step-layer--visible">
          <DoneStep savedRoutes={savedRoutes} onStartOver={handleStartOver} />
        </div>
      )}
    </div>
  );
}
