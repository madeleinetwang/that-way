from pathlib import Path

import numpy as np
import pandas as pd

SILVER_DIR = Path(__file__).resolve().parents[3] / "database/silver"
GOLD_DIR = Path(__file__).resolve().parents[3] / "database/gold"

# Speeds above this are treated as GPS error (teleport jitter) and nulled out.
# Generous enough to keep ground + most transit; the handful of airplane trips
# may lose some high-speed points but that is acceptable for preference modeling.
MAX_PLAUSIBLE_SPEED_MPS = 150.0


def load_silver():
    traces = pd.read_parquet(SILVER_DIR / "traces.parquet")
    trips = pd.read_parquet(SILVER_DIR / "trips.parquet")
    return traces, trips


def clean_speed_outliers(traces: pd.DataFrame) -> pd.DataFrame:
    """Null implausible GPS-jitter speeds while preserving the trajectory geometry."""
    outlier = traces["speed_mps"] > MAX_PLAUSIBLE_SPEED_MPS
    traces.loc[outlier, ["speed_mps", "step_distance_m"]] = np.nan
    return traces


def add_trip_flags(traces: pd.DataFrame) -> pd.DataFrame:
    grp = traces.groupby("source_file", sort=False)
    last_index = grp["point_index"].transform("max")
    traces["is_trip_start"] = traces["point_index"] == 0
    traces["is_trip_end"] = traces["point_index"] == last_index
    return traces


def enrich_with_trip_context(traces: pd.DataFrame, trips: pd.DataFrame) -> pd.DataFrame:
    context = trips[["source_file", "distance_m", "duration_s"]].rename(
        columns={"distance_m": "trip_distance_m", "duration_s": "trip_duration_s"}
    )
    return traces.merge(context, on="source_file", how="left")


def build_gold(traces: pd.DataFrame, trips: pd.DataFrame) -> pd.DataFrame:
    traces = clean_speed_outliers(traces)
    traces = add_trip_flags(traces)
    traces = enrich_with_trip_context(traces, trips)

    columns = [
        "geolife_user_id",
        "source_file",
        "recorded_at",
        "latitude",
        "longitude",
        "altitude_m",
        "speed_mps",
        "heading_deg",
        "step_distance_m",
        "point_index",
        "is_trip_start",
        "is_trip_end",
        "trip_distance_m",
        "trip_duration_s",
        "transport_mode",
    ]
    return traces[columns]


def run() -> None:
    GOLD_DIR.mkdir(parents=True, exist_ok=True)

    traces, trips = load_silver()
    gold = build_gold(traces, trips)

    gold.to_parquet(GOLD_DIR / "training_trajectories.parquet", index=False)
    print(f"gold: {len(gold):,} enriched trajectory points across {gold['source_file'].nunique():,} trips")


if __name__ == "__main__":
    run()
