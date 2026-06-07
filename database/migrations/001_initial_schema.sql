CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    display_name  TEXT,
    auth_uid      UUID UNIQUE
);

CREATE TABLE known_places (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    label        TEXT NOT NULL,
    location     GEOGRAPHY(POINT, 4326) NOT NULL,
    radius_m     NUMERIC(7, 2) NOT NULL DEFAULT 50,
    visit_count  INTEGER NOT NULL DEFAULT 0,
    last_visited TIMESTAMPTZ
);

CREATE INDEX known_places_user_id_idx  ON known_places (user_id);
CREATE INDEX known_places_location_idx ON known_places USING GIST (location);

CREATE TABLE frequented_routes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin_place_id  UUID NOT NULL REFERENCES known_places(id) ON DELETE CASCADE,
    dest_place_id    UUID NOT NULL REFERENCES known_places(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    trip_count       INTEGER NOT NULL DEFAULT 1,
    geometry         GEOGRAPHY(LINESTRING, 4326),
    distance_meters  NUMERIC(10, 2),
    duration_seconds INTEGER,
    behavior_profile JSONB NOT NULL DEFAULT '{}',

    UNIQUE (user_id, origin_place_id, dest_place_id)
);

CREATE INDEX frequented_routes_user_id_idx ON frequented_routes (user_id);

CREATE TYPE trip_status AS ENUM ('in_progress', 'completed', 'cancelled');

CREATE TABLE trips (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at           TIMESTAMPTZ,
    ended_at             TIMESTAMPTZ,
    status               trip_status NOT NULL DEFAULT 'in_progress',
    origin               GEOGRAPHY(POINT, 4326),
    destination          GEOGRAPHY(POINT, 4326),
    origin_label         TEXT,
    dest_label           TEXT,
    origin_place_id      UUID REFERENCES known_places(id) ON DELETE SET NULL,
    dest_place_id        UUID REFERENCES known_places(id) ON DELETE SET NULL,
    source_route_id      UUID REFERENCES frequented_routes(id) ON DELETE SET NULL,
    behavior_match_score NUMERIC(4, 3)
);

CREATE INDEX trips_user_id_idx ON trips (user_id);

CREATE TYPE maneuver_type AS ENUM (
    'depart', 'turn_left', 'turn_right', 'turn_slight_left', 'turn_slight_right',
    'turn_sharp_left', 'turn_sharp_right', 'straight', 'u_turn',
    'ramp', 'merge', 'fork', 'roundabout', 'arrive'
);

CREATE TABLE route_steps (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    step_index       SMALLINT NOT NULL,
    segment_id       TEXT,
    maneuver         maneuver_type,
    instruction      TEXT,
    geometry         GEOGRAPHY(LINESTRING, 4326),
    distance_meters  NUMERIC(8, 2),
    duration_seconds INTEGER,
    attributes       JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX route_steps_trip_id_step_index_idx ON route_steps (trip_id, step_index);

CREATE TYPE step_sentiment AS ENUM ('liked', 'disliked');

CREATE TABLE step_feedback (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id    UUID NOT NULL REFERENCES route_steps(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sentiment  step_sentiment NOT NULL,
    note       TEXT,

    UNIQUE (step_id, user_id)
);

CREATE INDEX step_feedback_user_id_idx ON step_feedback (user_id);

CREATE TABLE gps_traces (
    id          BIGSERIAL PRIMARY KEY,
    trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    location    GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy_m  NUMERIC(6, 2),
    speed_mps   NUMERIC(6, 3),
    heading_deg NUMERIC(5, 2)
);

CREATE INDEX gps_traces_trip_id_recorded_at_idx ON gps_traces (trip_id, recorded_at);
CREATE INDEX gps_traces_location_idx            ON gps_traces USING GIST (location);

CREATE TYPE preference_signal AS ENUM ('positive', 'negative', 'neutral');

CREATE TABLE road_segment_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    segment_id      TEXT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    signal          preference_signal NOT NULL DEFAULT 'neutral',
    times_traversed INTEGER NOT NULL DEFAULT 0,
    times_liked     INTEGER NOT NULL DEFAULT 0,
    times_disliked  INTEGER NOT NULL DEFAULT 0,
    context         JSONB NOT NULL DEFAULT '{}',
    geometry        GEOGRAPHY(LINESTRING, 4326),

    UNIQUE (user_id, segment_id)
);

CREATE INDEX road_segment_preferences_user_id_idx  ON road_segment_preferences (user_id);
CREATE INDEX road_segment_preferences_geometry_idx ON road_segment_preferences USING GIST (geometry);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER known_places_updated_at
    BEFORE UPDATE ON known_places FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER frequented_routes_updated_at
    BEFORE UPDATE ON frequented_routes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER road_segment_preferences_updated_at
    BEFORE UPDATE ON road_segment_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
