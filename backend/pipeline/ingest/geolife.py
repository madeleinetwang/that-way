import os
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[3] / "database/geolife_sample_data_raw"
BRONZE_DIR = Path(__file__).resolve().parents[3] / "database/bronze"


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


def assign_transport_modes(recorded_at: pd.Series, labels_df: pd.DataFrame) -> pd.Series:
    traces = pd.DataFrame({"recorded_at": recorded_at}).sort_values("recorded_at")
    labels = labels_df.sort_values("start_time")

    merged = pd.merge_asof(
        traces,
        labels,
        left_on="recorded_at",
        right_on="start_time",
        direction="backward",
    )
    merged["mode"] = merged.apply(
        lambda row: row["mode"] if pd.notna(row["end_time"]) and row["recorded_at"] <= row["end_time"] else None,
        axis=1,
    )
    return merged["mode"].values


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
            df["transport_mode"] = assign_transport_modes(recorded_at, labels_df)
        else:
            df["transport_mode"] = None
        frames.append(df)

    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def run(data_dir: Path = DATA_DIR, bronze_dir: Path = BRONZE_DIR) -> None:
    bronze_dir.mkdir(parents=True, exist_ok=True)
    user_dirs = sorted(d for d in data_dir.iterdir() if d.is_dir())

    for user_dir in user_dirs:
        out_path = bronze_dir / f"{user_dir.name}.parquet"
        if out_path.exists():
            print(f"{user_dir.name}: already ingested, skipping")
            continue
        df = ingest_user(user_dir)
        df.to_parquet(out_path, index=False)
        print(f"{user_dir.name}: {len(df)} rows → {out_path.name}")

    print("bronze ingestion complete")


if __name__ == "__main__":
    run()
