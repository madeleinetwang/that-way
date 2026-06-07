import { MAPBOX_TOKEN } from './constants';

function buildUrl(query, { limit = 1, proximity = null } = {}) {
  const prox = proximity ? `&proximity=${proximity.lng},${proximity.lat}` : '';
  return (
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=${limit}${prox}`
  );
}

function toResult(feature) {
  const [lng, lat] = feature.center;
  return { lng, lat, placeName: feature.place_name };
}

/** Single best match — used when you already have a confirmed selection. */
export async function geocode(query, proximity = null) {
  const res = await fetch(buildUrl(query, { limit: 1, proximity }));
  const data = await res.json();
  return data.features?.length > 0 ? toResult(data.features[0]) : null;
}

/** Live suggestions list — call as the user types. */
export async function suggest(query, proximity = null) {
  if (!query || query.trim().length < 2) return [];
  const res = await fetch(buildUrl(query, { limit: 5, proximity }));
  const data = await res.json();
  return (data.features ?? []).map(toResult);
}
