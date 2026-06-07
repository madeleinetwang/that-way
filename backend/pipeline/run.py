import argparse
import logging

from ingest.geolife import run as run_bronze

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


def main(layer: str):
    if layer == "bronze":
        try:
            run_bronze()
            logging.info("bronze layer ingestion complete")
        except Exception as e:
            logging.error(f"bronze layer failed: {e}")
            raise

    # silver and gold to be wired once implemented
    # if layer == "silver":
    #     run_silver()
    # if layer == "gold":
    #     run_gold()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--layer", choices=["bronze", "silver", "gold"], required=True)
    args = parser.parse_args()
    main(args.layer)
