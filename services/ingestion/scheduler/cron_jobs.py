from apscheduler.schedulers.blocking import BlockingScheduler
from services.ingestion.connectors.yahoo_finance import fetch_yahoo_ticks
from services.ingestion.connectors.fred_api import fetch_fred_indicator
from services.ingestion.connectors.world_bank import fetch_world_bank_indicator
from services.ingestion.scrapers.moneycontrol import scrape_moneycontrol
from services.ingestion.scrapers.economic_times import scrape_economic_times
from services.ingestion.etl.transform import transform_record
from services.ingestion.etl.iso_tagger import tag_country
from services.ingestion.etl.persistence_router import route_record

def run_market_pipeline():
    ticks = fetch_yahoo_ticks()
    for tick in ticks:
        transformed = transform_record(tick)
        tagged = tag_country(transformed)
        route_record(tagged)

def run_economic_pipeline():
    for series in ["GDP", "CPI"]:
        records = fetch_fred_indicator(series)
        for rec in records:
            transformed = transform_record(rec)
            tagged = tag_country(transformed)
            route_record(tagged)
    for country in ["USA", "IND", "GBR", "DEU", "JPN"]:
        records = fetch_world_bank_indicator(country, "NY.GDP.MKTP.CD")
        for rec in records:
            transformed = transform_record(rec)
            tagged = tag_country(transformed, country)
            route_record(tagged)

def run_news_pipeline():
    articles_mc = scrape_moneycontrol()
    for article in articles_mc:
        transformed = transform_record(article)
        tagged = tag_country(transformed)
        route_record(tagged)
    
    articles_et = scrape_economic_times()
    for article in articles_et:
        transformed = transform_record(article)
        tagged = tag_country(transformed)
        route_record(tagged)

def setup_scheduler():
    scheduler = BlockingScheduler()
    scheduler.add_job(run_market_pipeline, "interval", seconds=60)
    scheduler.add_job(run_news_pipeline, "interval", minutes=5)
    scheduler.add_job(run_economic_pipeline, "interval", hours=1)
    return scheduler

def run_scheduled_jobs():
    scheduler = setup_scheduler()
    scheduler.start()
