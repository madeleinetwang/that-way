from pathlib import Path

import numpy as np
import pandas as pd

BRONZE_DIR = Path(__file__).resolve().parents[3] / "database/bronze"
SILVER_DIR = Path(__file__).resolve().parents[3] / "database/silver"

BRONZE_COLUMNS = [
    "geolife_user_id",
    "source_file",
    "latitude",
    "longitude",
    "altitude_feet",
    "date_str",
    "time_str",
    "transport_mode",
]

EARTH_RADIUS_M = 6_371_000
FEET_TO_METERS = 0.3048


def load_bronze(bronze_dir: Path = BRONZE_DIR) -> pd.DataFrame:
    return pd.read_parquet(bronze_dir, columns=BRONZE_COLUMNS)


def parse_timestamps(df: pd.DataFrame) -> pd.DataFrame:
    df["recorded_at"] = pd.to_datetime(
        df["date_str"] + " " + df["time_str"],
        format="%Y-%m-%d %H:%M:%S",
    )
    return df.drop(columns=["date_str", "time_str"])


def convert_units(df: pd.DataFrame) -> pd.DataFrame:
    df["altitude_m"] = df["altitude_feet"] * FEET_TO_METERS
    return df.drop(columns=["altitude_feet"])


def drop_invalid(df: pd.DataFrame) -> pd.DataFrame:
    valid = df["latitude"].between(-90, 90) & df["longitude"].between(-180, 180)
    df = df[valid]
    df = df.drop_duplicates(subset=["geolife_user_id", "source_file", "recorded_at"])
    return df


def _haversine_m(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * np.arcsin(np.sqrt(a))


def _bearing_deg(lat1, lon1, lat2, lon2):
    lat1, lat2 = np.radians(lat1), np.radians(lat2)
    dlon = np.radians(lon2 - lon1)
    x = np.sin(dlon) * np.cos(lat2)
    y = np.cos(lat1) * np.sin(lat2) - np.sin(lat1) * np.cos(lat2) * np.cos(dlon)
    return (np.degrees(np.arctan2(x, y)) + 360) % 360


def derive_kinematics(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["source_file", "recorded_at"]).reset_index(drop=True)

    grp = df.groupby("source_file", sort=False)
    prev_lat = grp["latitude"].shift(1)
    prev_lon = grp["longitude"].shift(1)
    prev_time = grp["recorded_at"].shift(1)

    df["point_index"] = grp.cumcount()
    df["step_distance_m"] = _haversine_m(prev_lat, prev_lon, df["latitude"], df["longitude"])

    dt_seconds = (df["recorded_at"] - prev_time).dt.total_seconds()
    df["speed_mps"] = np.where(dt_seconds > 0, df["step_distance_m"] / dt_seconds, np.nan)
    df["heading_deg"] = _bearing_deg(prev_lat, prev_lon, df["latitude"], df["longitude"])

    # first point of each trip has no predecessor
    df.loc[df["point_index"] == 0, ["step_distance_m", "speed_mps", "heading_deg"]] = np.nan
    return df


def build_traces(df: pd.DataFrame) -> pd.DataFrame:
    df = parse_timestamps(df)
    df = convert_units(df)
    df = drop_invalid(df)
    df = derive_kinematics(df)
    return df


def build_trips(traces: pd.DataFrame) -> pd.DataFrame:
    grp = traces.groupby("source_file", sort=False)
    trips = grp.agg(
        geolife_user_id=("geolife_user_id", "first"),
        transport_mode=("transport_mode", "first"),
        started_at=("recorded_at", "min"),
        ended_at=("recorded_at", "max"),
        point_count=("recorded_at", "size"),
        distance_m=("step_distance_m", "sum"),
    ).reset_index()
    trips["duration_s"] = (trips["ended_at"] - trips["started_at"]).dt.total_seconds()
    return trips


def run() -> None:
    SILVER_DIR.mkdir(parents=True, exist_ok=True)

    bronze = load_bronze()
    traces = build_traces(bronze)
    trips = build_trips(traces)

    traces.to_parquet(SILVER_DIR / "traces.parquet", index=False)
    trips.to_parquet(SILVER_DIR / "trips.parquet", index=False)
    print(f"silver: {len(traces):,} traces across {len(trips):,} trips")


if __name__ == "__main__":
    run()
