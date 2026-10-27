FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/ingestion/requirements.txt ./services/ingestion/requirements.txt
RUN pip install --no-cache-dir -r services/ingestion/requirements.txt

COPY services /app/services
# Symbols for every country page (data/countries/<ISO>/market.json)
COPY data/countries /app/data/countries

ENV PYTHONPATH=/app

CMD ["python", "-u", "-m", "services.ingestion.main"]
