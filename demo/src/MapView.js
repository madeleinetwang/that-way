import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN } from './constants';

mapboxgl.accessToken = MAPBOX_TOKEN;

const DIRECTIONS_URL = (coords) =>
  `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

const EMPTY_GEOJSON = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [] },
  properties: {},
};

const DRAG_THRESHOLD_PX = 5;

const MapView = forwardRef(function MapView({ onReady }, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const userMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const userLocationRef = useRef(null);

  // Capture-phase route state. captureDestRef being non-null is what
  // arms the drag handlers — outside capture phase they're no-ops.
  const captureOriginRef = useRef(null);
  const captureDestRef = useRef(null);
  const captureWaypointRef = useRef(null); // {lng, lat} | null
  const captureGeomRef = useRef(null);
  const ghostMarkerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Build a Directions request with optional intermediate waypoint.
  // Coords always go in [lng, lat] order — matches what Mapbox expects.
  const fetchRoute = useCallback(async (origin, destination, waypoint) => {
    try {
      const parts = [`${origin.lng},${origin.lat}`];
      if (waypoint) parts.push(`${waypoint.lng},${waypoint.lat}`);
      parts.push(`${destination.lng},${destination.lat}`);
      const res = await fetch(DIRECTIONS_URL(parts.join(';')));
      if (!res.ok) {
        console.error('Directions HTTP', res.status, await res.text());
        return null;
      }
      const data = await res.json();
      return data.routes?.[0] ?? null;
    } catch (e) {
      console.error('fetchRoute error', e);
      return null;
    }
  }, []);

  // ── map init ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98.5795, 39.8283],
      zoom: 3.5,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

    const drawCaptureGeom = (geom) => {
      captureGeomRef.current = geom;
      if (!map.getSource('capture-route')) return;
      if (!geom) {
        map.getSource('capture-route').setData(EMPTY_GEOJSON);
        return;
      }
      map.getSource('capture-route').setData({
        type: 'Feature',
        geometry: geom,
        properties: {},
      });
    };

    const recompute = async () => {
      const origin = captureOriginRef.current;
      const destination = captureDestRef.current;
      if (!origin || !destination) return;
      const route = await fetchRoute(
        origin,
        destination,
        captureWaypointRef.current
      );
      if (route) drawCaptureGeom(route.geometry);
    };

    // Hover feedback: grab cursor when over the capture-line layer.
    const onHover = (e) => {
      if (isDraggingRef.current || !captureDestRef.current) return;
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['capture-line'],
      });
      map.getCanvas().style.cursor = features.length ? 'grab' : '';
    };

    // Mousedown on the route line → start a drag that commits a waypoint
    // at the drop location. Click without drag (below threshold) is ignored.
    const onMouseDown = (e) => {
      if (!captureDestRef.current) return;
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['capture-line'],
      });
      if (!features.length) return;

      e.preventDefault();
      isDraggingRef.current = true;
      map.dragPan.disable();
      map.getCanvas().style.cursor = 'grabbing';

      const startPoint = { x: e.point.x, y: e.point.y };

      const el = document.createElement('div');
      el.style.cssText = [
        'width: 18px',
        'height: 18px',
        'border-radius: 50%',
        'background: #4facfe',
        'border: 3px solid #fff',
        'box-shadow: 0 2px 10px rgba(0,0,0,0.45)',
        'pointer-events: none',
      ].join(';');
      ghostMarkerRef.current = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat(e.lngLat)
        .addTo(map);

      const onDragMove = (ev) => {
        ghostMarkerRef.current?.setLngLat(ev.lngLat);
      };

      const onDragUp = async (ev) => {
        map.off('mousemove', onDragMove);
        map.off('mouseup', onDragUp);
        isDraggingRef.current = false;
        map.dragPan.enable();
        map.getCanvas().style.cursor = '';
        ghostMarkerRef.current?.remove();
        ghostMarkerRef.current = null;

        const dx = ev.point.x - startPoint.x;
        const dy = ev.point.y - startPoint.y;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

        captureWaypointRef.current = {
          lng: ev.lngLat.lng,
          lat: ev.lngLat.lat,
        };
        await recompute();
      };

      map.on('mousemove', onDragMove);
      map.on('mouseup', onDragUp);
    };

    map.on('load', () => {
      // Destination-step final route (dashed orange, non-interactive)
      map.addSource('dest-route', { type: 'geojson', data: EMPTY_GEOJSON });
      map.addLayer({
        id: 'dest-shadow',
        type: 'line',
        source: 'dest-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#000', 'line-width': 10, 'line-opacity': 0.4 },
      });
      map.addLayer({
        id: 'dest-line',
        type: 'line',
        source: 'dest-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#FF6B35',
          'line-width': 5,
          'line-dasharray': [1.5, 1.5],
        },
      });

      // Capture-step draggable route (solid blue). The capture-line layer
      // ID is what onHover/onMouseDown hit-test against — keep them in sync.
      map.addSource('capture-route', { type: 'geojson', data: EMPTY_GEOJSON });
      map.addLayer({
        id: 'capture-shadow',
        type: 'line',
        source: 'capture-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#000', 'line-width': 12, 'line-opacity': 0.5 },
      });
      map.addLayer({
        id: 'capture-line',
        type: 'line',
        source: 'capture-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#4facfe',
          'line-width': 6,
          'line-opacity': 0.95,
        },
      });

      map.on('mousemove', onHover);
      map.on('mousedown', onMouseDown);

      onReady?.();
    });

    mapRef.current = map;
    return () => map.remove();
  }, [fetchRoute]);

  // ── imperative API ─────────────────────────────────────────────────────────

  useImperativeHandle(
    ref,
    () => ({
      setUserLocation: (lng, lat) => {
        const map = mapRef.current;
        if (!map) return;
        userLocationRef.current = { lng, lat };

        userMarkerRef.current?.remove();
        const el = document.createElement('div');
        el.className = 'user-location-marker';
        userMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);

        map.flyTo({ center: [lng, lat], zoom: 13, duration: 2000 });
      },

      // Fetches origin → destination via Directions API and draws it on
      // the capture-line layer. Resolves as soon as the route is on screen.
      startRouteCapture: async (destLng, destLat) => {
        const map = mapRef.current;
        if (!map || !userLocationRef.current) return;

        captureOriginRef.current = { ...userLocationRef.current };
        captureDestRef.current = { lng: destLng, lat: destLat };
        captureWaypointRef.current = null;
        captureGeomRef.current = null;

        const route = await fetchRoute(
          captureOriginRef.current,
          captureDestRef.current,
          null
        );
        if (!route) return;

        map.getSource('capture-route').setData({
          type: 'Feature',
          geometry: route.geometry,
          properties: {},
        });
        captureGeomRef.current = route.geometry;

        const coords = route.geometry.coordinates;
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 260, left: 60, right: 60 },
          duration: 1500,
        });
      },

      getSavedRoute: () => ({
        origin: captureOriginRef.current
          ? { ...captureOriginRef.current }
          : null,
        destination: captureDestRef.current
          ? { ...captureDestRef.current }
          : null,
        waypoints: captureWaypointRef.current
          ? [{ ...captureWaypointRef.current }]
          : [],
        geometry: captureGeomRef.current,
      }),

      clearRoute: () => {
        const map = mapRef.current;
        captureOriginRef.current = null;
        captureDestRef.current = null;
        captureWaypointRef.current = null;
        captureGeomRef.current = null;
        ghostMarkerRef.current?.remove();
        ghostMarkerRef.current = null;
        isDraggingRef.current = false;
        if (map?.getSource('capture-route')) {
          map.getSource('capture-route').setData(EMPTY_GEOJSON);
        }
        if (map) {
          map.dragPan.enable();
          map.getCanvas().style.cursor = '';
        }
      },

      showDestinationRoute: async (destLng, destLat) => {
        const map = mapRef.current;
        if (!map || !userLocationRef.current) return;

        // Leaving capture mode — disarm the drag handlers and clear the line.
        captureOriginRef.current = null;
        captureDestRef.current = null;
        captureWaypointRef.current = null;
        captureGeomRef.current = null;
        if (map.getSource('capture-route')) {
          map.getSource('capture-route').setData(EMPTY_GEOJSON);
        }

        const route = await fetchRoute(
          userLocationRef.current,
          { lng: destLng, lat: destLat },
          null
        );
        if (!route) return;

        destMarkerRef.current?.remove();
        const el = document.createElement('div');
        el.className = 'dest-marker dest-marker--final';
        destMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([destLng, destLat])
          .addTo(map);

        map.getSource('dest-route').setData({
          type: 'Feature',
          geometry: route.geometry,
          properties: {},
        });

        const coords = route.geometry.coordinates;
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 220, left: 60, right: 60 },
          duration: 1500,
        });
      },

      clearAll: () => {
        const map = mapRef.current;
        if (!map) return;

        userMarkerRef.current?.remove();
        destMarkerRef.current?.remove();
        userMarkerRef.current = null;
        destMarkerRef.current = null;
        userLocationRef.current = null;

        captureOriginRef.current = null;
        captureDestRef.current = null;
        captureWaypointRef.current = null;
        captureGeomRef.current = null;
        ghostMarkerRef.current?.remove();
        ghostMarkerRef.current = null;
        isDraggingRef.current = false;
        map.dragPan.enable();
        map.getCanvas().style.cursor = '';

        if (map.getSource('dest-route')) {
          map.getSource('dest-route').setData(EMPTY_GEOJSON);
        }
        if (map.getSource('capture-route')) {
          map.getSource('capture-route').setData(EMPTY_GEOJSON);
        }

        map.flyTo({ center: [-98.5795, 39.8283], zoom: 3.5, duration: 2000 });
      },
    }),
    [fetchRoute]
  );

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    />
  );
});

export default MapView;
