import pandas as pd 
from pathlib import Path
from supabase import create_client
import os

client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

def parse_geolife_plt_files(file_path):
    df = pd.read_csv(file_path,
                    skiprows=6,
                    header=None,
                    names=["latitude", "longitude", "unused", "altitude_feet", "days_since_1899", "date", "time"])    
    return df

def parse_labels(labels_file_path):
    df = pd.read_csv(labels_file_path,
                    sep="\t",
                    skiprows=1, 
                    header=None,
                    names=["start_time", "end_time", "mode"])
    df["start_time"] = pd.to_datetime(df["start_time"])
    df["end_time"] = pd.to_datetime(df["end_time"])
    return df 

def get_transport_mode(timestamp, labels_df):
    if labels_df is None: 
        return None
    match = labels_df[(labels_df["start_time"] <= timestamp) & (labels_df["end_time"] >= timestamp)]
    return match["mode"].values[0] if len(match) else None

DATA_DIR = Path("../database/geolife_sample_data_raw")
plt_files = sorted(DATA_DIR.glob("*/Trajectory/*.plt"))
print(f"{len(plt_files)} files found")

result = pd.DataFrame(["latitude", "longitude", "unused", "altitude_feet", "days_since_1899", "date", "time", "mode"])

for sample_file in plt_files:
    df = parse_geolife_plt_files(sample_file)
    # if label.txt file exists apply get_transport_mode
    if sample_file.glob()
        df.apply(get_transport_mode)
    result.append(df)


# send final result to supabase db
