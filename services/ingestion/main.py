from services.ingestion.scheduler.cron_jobs import run_scheduled_jobs

def main() -> None:
    run_scheduled_jobs()

if __name__ == "__main__":
    main()
