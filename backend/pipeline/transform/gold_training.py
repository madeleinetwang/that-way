# Gold layer — model-ready training dataset
#
# Reads from silver_geolife_trips + silver_geolife_traces.
# Outputs to gold_training_trajectories.
#
# Each row = one GPS point enriched with trip-level context:
#   user_id, trip_id, recorded_at, location, altitude_m,
#   speed_mps, heading_deg, trip_distance_m, trip_duration_s,
#   point_index, is_trip_start, is_trip_end
#
# This is the table the model trains on to learn navigation behavior patterns.
#
# TODO: implement enrich_with_trip_context(traces_df, trips_df) -> df
# TODO: implement run() -> None
