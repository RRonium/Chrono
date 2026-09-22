FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/backend/requirements.txt ./services/backend/requirements.txt
RUN pip install --no-cache-dir -r services/backend/requirements.txt

COPY . .

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "services.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
