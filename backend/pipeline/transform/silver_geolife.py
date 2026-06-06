# Silver layer — GeoLife cleaning and structuring
#
# Reads from bronze_geolife_traces.
# Outputs to:
#   - silver_geolife_trips    (one row per .plt file / trip)
#   - silver_geolife_traces   (cleaned GPS points linked to a trip)
#
# Transformations to apply:
#   - parse timestamps from (date, time) string columns → TIMESTAMPTZ
#   - convert altitude from feet → meters
#   - derive speed_mps and heading_deg from consecutive points
#   - drop rows with invalid coordinates (lat outside ±90, lon outside ±180)
#   - drop duplicate (user_id, recorded_at) points
#   - segment into trips (one bronze file = one silver trip)
#
# TODO: implement clean_traces(df) -> df
# TODO: implement derive_kinematics(df) -> df  (speed, heading)
# TODO: implement run() -> None
