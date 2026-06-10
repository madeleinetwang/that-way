import argparse
import logging

from ingest.geolife import run as run_bronze
from transform.silver_geolife import run as run_silver
from transform.gold_training import run as run_gold

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


def main(layer: str):
    if layer == "bronze":
        try:
            run_bronze()
            logging.info("bronze layer ingestion complete")
        except Exception as e:
            logging.error(f"bronze layer failed: {e}")
            raise

    if layer == "silver":
        try:
            run_silver()
            logging.info("silver layer transform complete")
        except Exception as e:
            logging.error(f"silver layer failed: {e}")
            raise

    if layer == "gold":
        try:
            run_gold()
            logging.info("gold layer transform complete")
        except Exception as e:
            logging.error(f"gold layer failed: {e}")
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--layer", choices=["bronze", "silver", "gold"], required=True)
    args = parser.parse_args()
    main(args.layer)
