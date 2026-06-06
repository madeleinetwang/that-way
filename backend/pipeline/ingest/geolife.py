# Bronze layer — GeoLife ingestion
#
# Reads raw .plt files from database/sample_data/ and writes
# unmodified rows to the bronze_geolife_traces table.
#
# .plt file format (GeoLife v1.3):
#   6-line header (ignore)
#   columns: latitude, longitude, unused, altitude_feet, days_since_1899, date, time
#
# TODO: implement load_plt_file(path) -> list[dict]
# TODO: implement ingest_user(user_dir: Path) -> int  (returns row count)
# TODO: implement run(sample_data_dir: Path) -> None  (iterates all 182 users)
