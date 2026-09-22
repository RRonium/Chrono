import asyncio
import logging

from services.ingestion.scheduler.cron_jobs import run_scheduled_jobs

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

def main() -> None:
    asyncio.run(run_scheduled_jobs())

if __name__ == "__main__":
    main()
