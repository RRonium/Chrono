from datetime import datetime, timezone

def transform_record(record: dict) -> dict:
    cleaned = dict(record)
    for k, v in cleaned.items():
        if isinstance(v, (int, float)):
            cleaned[k] = round(float(v), 4)
        elif isinstance(v, str) and ("date" in k or "time" in k or k == "published_at"):
            try:
                dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                else:
                    dt = dt.astimezone(timezone.utc)
                cleaned[k] = dt.isoformat()
            except Exception:
                pass
    return cleaned
