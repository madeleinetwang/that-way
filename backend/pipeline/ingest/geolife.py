import os
from pathlib import Path

import pandas as pd
from supabase import create_client

client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])

DATA_DIR = Path(__file__).resolve().parents[3] / "database/geolife_sample_data_raw"


def parse_plt_file(file_path: Path) -> pd.DataFrame:
    df = pd.read_csv(
        file_path,
        skiprows=6,
        header=None,
        names=["latitude", "longitude", "unused", "altitude_feet", "days_since_1899", "date_str", "time_str"],
    )
    return df.drop(columns=["unused", "days_since_1899"])


def parse_labels(labels_path: Path) -> pd.DataFrame:
    df = pd.read_csv(
        labels_path,
        sep="\t",
        skiprows=1,
        header=None,
        names=["start_time", "end_time", "mode"],
    )
    df["start_time"] = pd.to_datetime(df["start_time"])
    df["end_time"] = pd.to_datetime(df["end_time"])
    return df


def get_transport_mode(timestamp: pd.Timestamp, labels_df: pd.DataFrame):
    if labels_df is None:
        return None
    match = labels_df[(labels_df["start_time"] <= timestamp) & (labels_df["end_time"] >= timestamp)]
    return match["mode"].values[0] if len(match) else None


def ingest_user(user_dir: Path) -> pd.DataFrame:
    plt_files = sorted(user_dir.glob("Trajectory/*.plt"))
    labels_path = user_dir / "labels.txt"
    labels_df = parse_labels(labels_path) if labels_path.exists() else None

    frames = []
    for plt_file in plt_files:
        df = parse_plt_file(plt_file)
        df["source_file"] = str(plt_file)
        df["geolife_user_id"] = user_dir.name
        if labels_df is not None:
            recorded_at = pd.to_datetime(df["date_str"] + " " + df["time_str"])
            df["transport_mode"] = recorded_at.apply(lambda ts: get_transport_mode(ts, labels_df))
        else:
            df["transport_mode"] = None
        frames.append(df)

    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def run(data_dir: Path = DATA_DIR) -> None:
    user_dirs = sorted(d for d in data_dir.iterdir() if d.is_dir())
    all_frames = []

    for user_dir in user_dirs:
        df = ingest_user(user_dir)
        all_frames.append(df)
        print(f"{user_dir.name}: {len(df)} rows")

    result = pd.concat(all_frames, ignore_index=True)
    print(f"total: {len(result)} rows")

    records = result.to_dict(orient="records")
    client.table("bronze_geolife_traces").insert(records).execute()


if __name__ == "__main__":
    run()
