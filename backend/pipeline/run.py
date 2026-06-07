# Pipeline orchestrator — runs all layers top to bottom
#
# Usage:
#   python -m backend.pipeline.run
#   python -m backend.pipeline.run --layer bronze
#   python -m backend.pipeline.run --layer silver
#   python -m backend.pipeline.run --layer gold
#
# Each layer is idempotent — safe to re-run.
#
# TODO: implement CLI arg parsing (--layer flag)
# TODO: wire ingest.geolife.run()
# TODO: wire transform.silver_geolife.run()
# TODO: wire transform.gold_training.run()
# TODO: add row-count logging between layers
