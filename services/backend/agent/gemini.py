"""Minimal Gemini REST client (generateContent) using the standard library, run in a worker thread."""

import asyncio
import json
import logging
import os
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"

# Free-tier models get "high demand" 503s at busy times, so try a few in order.
DEFAULT_MODELS = "gemini-3.5-flash,gemini-flash-latest,gemini-3.8-flash,gemini-3.5-flash-lite"
RETRY_ROUNDS = 3  # passes over the model list, with a growing pause between passes


class GeminiError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def api_key() -> str:
    return os.getenv("GEMINI_API_KEY", "").strip()


def models() -> list[str]:
    return [m.strip() for m in os.getenv("GEMINI_MODELS", DEFAULT_MODELS).split(",") if m.strip()]


def _post(model: str, body: dict, timeout: int) -> dict:
    req = urllib.request.Request(
        f"{API_ROOT}/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json", "x-goog-api-key": api_key()},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.load(res)


async def generate(body: dict, timeout: int = 90, prefer: str | None = None) -> tuple[dict, str]:
    """Returns (response, model used). Falls through to the next model on overload or a retired model.
    `prefer` keeps a multi-step turn on one model, since thought signatures are model-specific."""
    if not api_key():
        raise GeminiError("GEMINI_API_KEY is not set on the backend", status=503)
    last_error = "no model configured"
    for attempt in range(RETRY_ROUNDS):
        if attempt:
            await asyncio.sleep(2 * attempt)
        order = models()
        if prefer in order:
            order = [prefer] + [m for m in order if m != prefer]
        for model in order:
            try:
                return await asyncio.to_thread(_post, model, body, timeout), model
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode(errors="replace")[:300]
                logger.warning("Gemini %s returned %s: %s", model, exc.code, detail)
                if exc.code == 429:
                    raise GeminiError("The free Gemini quota is used up for now. Try again in a minute.", status=429)
                if exc.code in (400, 401, 403):
                    raise GeminiError(f"Gemini rejected the request ({exc.code}). Check GEMINI_API_KEY.", status=502)
                last_error = f"{model}: HTTP {exc.code}"
            except (urllib.error.URLError, TimeoutError) as exc:
                logger.warning("Gemini %s unreachable: %s", model, exc)
                last_error = f"{model}: {exc}"
    raise GeminiError(f"Gemini is busy right now ({last_error}). Try again shortly.", status=503)
