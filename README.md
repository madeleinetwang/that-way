# that-way

A personalized navigation web app with custom end-to-end statistical model that learns your driving habits over time.

## Problem Statement

Whenever I am going to some place new, I oftentimes find myself being taken down "popular" or "most-optimal" routes by navigation apps. Although I know my local streets and what I prefer, I still rely on navigation apps to take me some place, however upon my arrival, I often think I could've taken a much easier route! This application is meant to solve that by predicting the best route for you based on _your_ driving habits rather than the "most optimized" route.

## How it works (FUTURE)

This app learns your navigation habits and applies them.

**Learning phase** — as you drive to frequented places (home, work, the gym, grocery
store), the system observes your actual path: which roads you take, which turns you make, which side of the parking lot you enter from. Over time it builds a behavioral profile for each origin→destination pair.

**New trips** — when you navigate somewhere new, the system applies your learned
behaviors to influence route generation. If you consistently avoid u-turns (like me), it avoids them. If you always prefer residential streets near your neighborhood, it biases toward those. The route just appears — no upfront choices, no interruptions while you drive.

**Post-trip feedback** — after you arrive, you can optionally review the steps of your
route and flag any you liked or disliked. This is the only explicit input the system asks for. Those flags refine the segment-level preference model for future trips.

---

## Stack

| Layer              | Technology                        |
| ------------------ | --------------------------------- |
| Mobile             | Expo React Native / SwiftUI (TBD) |
| Backend / Pipeline | Python                            |
| Database           | Supabase (Postgres + PostGIS)     |

---

## Project structure

```
that-way/
├── backend/
│   ├── api/                  # HTTP handlers (FastAPI or similar)
│   ├── models/               # Pydantic models mirroring DB tables
│   ├── pipeline/
│   │   ├── ingest/
│   │   │   └── geolife.py         # Bronze: parse .plt files → local Parquet
│   │   ├── transform/
│   │   │   ├── silver_geolife.py  # Silver: clean + segment trips + kinematics
│   │   │   └── gold_training.py   # Gold: clean outliers + trip context → model-ready
│   │   └── run.py                 # Orchestrator (--layer bronze/silver/gold)
│   └── utils/                     # Supabase client, shared helpers
├── database/
│   ├── migrations/                # SQL migration files (production app schema)
│   ├── seeds/                     # Development seed data
│   ├── geolife_sample_data_raw/   # GeoLife raw .plt files (gitignored — see setup)
│   ├── bronze/                    # Local Parquet: raw parsed points (gitignored)
│   ├── silver/                    # Local Parquet: cleaned traces + trips (gitignored)
│   └── gold/                      # Local Parquet: model-ready trajectories (gitignored)
├── notebooks/                # Analysis and experiments
├── mobile/           # iOS app (Expo / SwiftUI — TBD)
├── scripts/          # One-off admin / migration scripts
├── docs/             # Architecture notes, ADRs
├── .env.template     # Copy to .env and fill in credentials
└── README.md
```

---

## Database schema

### `users`

Core user record. Linked to Supabase Auth via `auth_uid`.

### `known_places`

Frequented locations the user has labeled ("Home", "Work") or that the system infers from
visit frequency. Each place has an arrival detection radius and a visit count. These are
the anchor points for building behavioral patterns.

### `frequented_routes`

A learned behavioral pattern between two known places. Built up across multiple observed
trips on the same origin→destination pair. The `behavior_profile` JSONB column captures
distilled habits: left-turn avoidance, road type preference, parking lot entry heading,
typical time of day, etc. Unique per `(user, origin_place, dest_place)` — upserted as
more trips arrive.

### `trips`

One row per navigation session. The route is generated automatically from the user's
learned behavior — no upfront options shown. Optionally linked to `known_places` if either
endpoint is a recognized place, and to the `frequented_routes` record whose profile was
used to shape the generated route.

### `route_steps`

Ordered navigation instructions within a trip. Each step corresponds to a road segment or
maneuver (`turn_left`, `merge`, `roundabout`, etc.) and carries the segment ID, geometry,
and an `attributes` JSONB blob for context available at generation time. **This is the
unit that post-trip feedback targets.**

### `step_feedback`

Post-trip feedback on individual steps — `liked` or `disliked`, with an optional note.
Collected after the user arrives, never during. Drives updates to
`road_segment_preferences`.

### `gps_traces`

Raw GPS breadcrumbs recorded during a trip. Spatial index supports map-matching and
behavioral pattern extraction.

### `road_segment_preferences`

Per-user learned signal on road segments, derived from step feedback and observed
traversals. Stores raw tallies (`times_traversed`, `times_liked`, `times_disliked`) so
the scoring algorithm can be tuned independently of stored data. The `context` JSONB
captures behavioral metadata learned from how the user drives each segment.

---

## Data flow

```
GPS traces (during trip)
        │
        ▼
  Post-trip pipeline
        │
        ├─► known_places: increment visit_count, update last_visited
        │
        ├─► frequented_routes: upsert behavior_profile for this place pair
        │
        └─► road_segment_preferences: update traversal counts

Step feedback (user, post-trip)
        │
        ▼
  road_segment_preferences: increment liked/disliked counts, update signal
        │
        ▼
  frequented_routes: refine behavior_profile for affected place pairs

Route generation (next trip to new destination)
        │
        ├─ load road_segment_preferences for user
        ├─ load relevant frequented_routes behavior_profile
        └─► routing engine call with preference weights applied
```

---

## Setup

### 1. Clone and create your environment file

```bash
cp .env.template .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Enable the **PostGIS** extension under Database → Extensions.
3. Copy your project URL and API keys into `.env`.

### 3. Run migrations (optional for the data pipeline)

The data pipeline runs entirely on local Parquet (see step 6), so Supabase is **not required** to build the training data. Run the migrations only when you're ready to work on the production app schema.

```bash
psql "$SUPABASE_DB_URL" -f database/migrations/001_initial_schema.sql   # production app tables
psql "$SUPABASE_DB_URL" -f database/migrations/002_medallion_layers.sql # cloud medallion tables (reference schema)
```

For development seed data:

```bash
psql "$SUPABASE_DB_URL" -f database/seeds/001_dev_seed.sql
```

### 4. Download sample training data

`database/geolife_sample_data_raw/` is excluded from git. Download the GeoLife GPS Trajectories dataset (v1.3) from [Microsoft](https://www.microsoft.com/en-us/download/details.aspx?id=52367), extract the zip, and place the user folders (000–181) directly under `database/geolife_sample_data_raw/`.

### 5. Install Python dependencies

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 6. Run the pipeline

The pipeline follows a medallion architecture. All three layers run **locally** and write Parquet files under `database/` — no database connection is required to build the training data.

```bash
cd backend/pipeline

# parse raw .plt files → database/bronze/*.parquet (one file per user)
../.venv/bin/python3 run.py --layer bronze

# clean, segment into trips, derive kinematics → database/silver/{traces,trips}.parquet
../.venv/bin/python3 run.py --layer silver

# clean speed outliers + join trip context → database/gold/training_trajectories.parquet
../.venv/bin/python3 run.py --layer gold
```

Each layer is idempotent — safe to re-run. Approximate runtimes on the full 182-user dataset: bronze ~170s, silver ~50s, gold ~25s.

> **Why local Parquet instead of Supabase?**
> The processed GeoLife data is point-level — ~24.2M GPS rows. That far exceeds the Supabase free-tier storage limit (~500 MB – 1 GB), which puts the project into read-only mode once full. Parquet is columnar and compressed, so the entire dataset reads back into pandas in a few seconds with no network round-trips. Supabase (and the `001`/`002` migrations) is reserved for the **production app schema** and, later, small summary tables (e.g. per-trip or per-user features) that comfortably fit the free tier. The medallion Parquet files are gitignored and rebuilt locally via the commands above.

---

## Notebooks

- [`notebooks/route_preference_hypothesis.ipynb`](notebooks/route_preference_hypothesis.ipynb) — explores the GeoLife GPS dataset and validates the hypothesis that user navigation preferences can be learned from repeated trajectory patterns.

---

## Model training data

The behavior prediction model is trained on the data in `database/geolife_sample_data_raw/`, derived from the [GeoLife GPS Trajectories](https://www.microsoft.com/en-us/download/details.aspx?id=52367) dataset (Microsoft Research Asia, v1.3). GeoLife contains 17,621 GPS trajectories from 182 users collected over five years, covering a wide range of real-world outdoor movements.

Training on this data allows the model to learn general navigation behavior patterns before personalizing to individual users.

**Required citations for GeoLife data:**

- Yu Zheng et al. _Mining interesting locations and travel sequences from GPS trajectories._ WWW 2009.
- Yu Zheng et al. _Understanding Mobility Based on GPS Data._ UbiComp 2008.
- Yu Zheng et al. _GeoLife: A Collaborative Social Networking Service among User, Location and Trajectory._ IEEE Data Engineering Bulletin, 33(2), 2010.

---

## Development roadmap

### Phase 1 — Data pipeline (current focus)

- [x] Bronze ingestion: parse GeoLife `.plt` files → `database/bronze/*.parquet`
- [x] Silver transform: clean, type, segment into trips, derive kinematics → `database/silver/{traces,trips}.parquet`
- [x] Gold transform: clean speed outliers + join trip context → `database/gold/training_trajectories.parquet`

### Phase 2 — Model

- [ ] EDA in `notebooks/route_preference_hypothesis.ipynb`
- [ ] Feature engineering: known place inference, behavioral features per trip
- [ ] Train behavior prediction model on gold dataset
- [ ] Evaluate: does the model generalize across users?

### Phase 3 — Application (later)

- [ ] Route generation pipeline (OSRM / Valhalla + preference weights)
- [ ] Post-trip feedback API endpoint
- [ ] Segment preference scoring algorithm
- [ ] Mobile UI (Expo React Native or SwiftUI)
