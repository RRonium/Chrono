import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException

# Same folder the web app is built from: <repo>/data/countries/<ISO>/{profile.json, market.json, boundary.geojson}
COUNTRIES_DIR = Path(__file__).resolve().parents[3] / "data" / "countries"

router = APIRouter(prefix="/api/v1/countries", tags=["countries"])


@lru_cache(maxsize=None)
def _read(*parts: str):
    path = COUNTRIES_DIR.joinpath(*parts)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


@router.get("")
async def list_countries():
    index = _read("index.json")
    if index is None:
        raise HTTPException(status_code=503, detail="Country data missing; run scripts/refresh_country_data.py")
    return index


@router.get("/{iso_code}")
async def get_country(iso_code: str, boundary: bool = False):
    iso = iso_code.upper()
    if not iso.isalpha() or len(iso) != 3:
        raise HTTPException(status_code=400, detail="Use an ISO 3166-1 alpha-3 code")
    profile = _read(iso, "profile.json")
    if profile is None:
        raise HTTPException(status_code=404, detail="Country not found")
    result = {"profile": profile, "market": _read(iso, "market.json")}
    if boundary:
        result["boundary"] = _read(iso, "boundary.geojson")
    return result
