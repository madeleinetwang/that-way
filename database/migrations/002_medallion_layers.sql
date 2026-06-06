-- Medallion pipeline tables for GeoLife training data
--
-- Bronze: raw .plt rows, untouched
-- Silver: cleaned trips + traces
-- Gold:   model-ready enriched trajectories

-- ============================================================
-- BRONZE
-- ============================================================
CREATE TABLE bronze_geolife_traces (
    id              BIGSERIAL PRIMARY KEY,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file     TEXT NOT NULL,          -- relative path to .plt file
    geolife_user_id TEXT NOT NULL,          -- folder name, e.g. "042"
    -- raw columns from .plt (no transforms applied)
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    altitude_feet   DOUBLE PRECISION,
    date_str        TEXT NOT NULL,          -- "YYYY-MM-DD"
    time_str        TEXT NOT NULL,          -- "HH:MM:SS"

    UNIQUE (source_file, date_str, time_str)  -- idempotent re-runs
);

CREATE INDEX bronze_geolife_traces_user_idx ON bronze_geolife_traces (geolife_user_id);

-- ============================================================
-- SILVER
-- ============================================================
CREATE TABLE silver_geolife_trips (
    id               BIGSERIAL PRIMARY KEY,
    geolife_user_id  TEXT NOT NULL,
    source_file      TEXT NOT NULL UNIQUE,
    started_at       TIMESTAMPTZ NOT NULL,
    ended_at         TIMESTAMPTZ NOT NULL,
    point_count      INTEGER NOT NULL,
    distance_m       NUMERIC(10, 2),
    duration_s       INTEGER
);

CREATE TABLE silver_geolife_traces (
    id              BIGSERIAL PRIMARY KEY,
    trip_id         BIGINT NOT NULL REFERENCES silver_geolife_trips(id) ON DELETE CASCADE,
    geolife_user_id TEXT NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL,
    location        GEOGRAPHY(POINT, 4326) NOT NULL,
    altitude_m      NUMERIC(8, 2),
    speed_mps       NUMERIC(6, 3),
    heading_deg     NUMERIC(5, 2),
    point_index     INTEGER NOT NULL
);

CREATE INDEX silver_geolife_traces_trip_idx      ON silver_geolife_traces (trip_id);
CREATE INDEX silver_geolife_traces_user_idx      ON silver_geolife_traces (geolife_user_id);
CREATE INDEX silver_geolife_traces_location_idx  ON silver_geolife_traces USING GIST (location);

-- ============================================================
-- GOLD
-- ============================================================
CREATE TABLE gold_training_trajectories (
    id              BIGSERIAL PRIMARY KEY,
    geolife_user_id TEXT NOT NULL,
    trip_id         BIGINT NOT NULL REFERENCES silver_geolife_trips(id) ON DELETE CASCADE,
    recorded_at     TIMESTAMPTZ NOT NULL,
    location        GEOGRAPHY(POINT, 4326) NOT NULL,
    altitude_m      NUMERIC(8, 2),
    speed_mps       NUMERIC(6, 3),
    heading_deg     NUMERIC(5, 2),
    point_index     INTEGER NOT NULL,
    is_trip_start   BOOLEAN NOT NULL DEFAULT false,
    is_trip_end     BOOLEAN NOT NULL DEFAULT false,
    trip_distance_m NUMERIC(10, 2),
    trip_duration_s INTEGER
);

CREATE INDEX gold_training_traj_user_idx     ON gold_training_trajectories (geolife_user_id);
CREATE INDEX gold_training_traj_trip_idx     ON gold_training_trajectories (trip_id);
CREATE INDEX gold_training_traj_location_idx ON gold_training_trajectories USING GIST (location);
