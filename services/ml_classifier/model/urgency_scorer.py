"""Urgency scoring for classified news articles.

Combines multiple metrics into a normalized urgency score [0.0, 1.0]:
- Sentiment polarity (BULLISH positive sentiment can indicate hype; BEARISH fear can indicate risk)
- Keyword severity weights (crisis, surge, crash, inflation, etc.)
- ISO entity impact (mentioned country gets higher relevance score)
- Source credibility (established sources vs unknown)
- Recency decay (newer articles have higher urgency)

Final score thresholds map to urgency colors on the 3D globe:
  Green:   score <= 40
  Yellow:  41 <= score <= 70
  Red:     score > 70
"""

import logging
import re
import time
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Keyword severity weights — higher = more urgent
SEVERITY_KEYWORDS: Dict[str, float] = {
    # Crisis-level
    "crisis": 0.40,
    "crash": 0.40,
    "default": 0.30,
    # High severity
    "surge": 0.30,
    "inflation": 0.25,
    "bankruptcy": 0.35,
    "recession": 0.30,
    "war": 0.50,
    "conflict": 0.35,
    "breaking": 0.15,
    # Medium severity
    "rate": 0.10,
    "policy": 0.08,
    "earnings": 0.12,
    "guidance": 0.10,
    # Low severity
    "update": 0.03,
    "note": 0.02,
    "commentary": 0.05,
}

# Raw keyword weight at which severity is treated as maximal
KEYWORD_SATURATION = 0.6

# Component weights; they sum to 1.0 so a fresh, severe, bearish story can reach red.
WEIGHT_KEYWORDS = 0.45
WEIGHT_SENTIMENT = 0.20
WEIGHT_ISO = 0.10
WEIGHT_SOURCE = 0.10
WEIGHT_RECENCY = 0.15

# Source credibility weights (normalized to 0-1, higher = more trusted / more impact)
SOURCE_CREDIBILITY: Dict[str, float] = {
    "reuters": 0.9,
    "bbc": 0.85,
    "financial_times": 0.9,
    "bloomberg": 0.9,
    "economist": 0.88,
    "moneycontrol": 0.75,
    "economic_times": 0.75,
    "reuters_rss": 0.85,
    "newsapi": 0.70,
    "default": 0.50,
}

# Recency half-life in hours (after half-life, urgency decays by 50%)
RECENCY_HALF_LIFE_HOURS = 24.0


def _extract_iso_codes(text: str) -> set[str]:
    """Extract ISO country codes mentioned in the article text."""
    from services.ingestion.etl.iso_tagger import map_text_to_iso

    codes: set[str] = set()
    lower = text.lower()
    # map_text_to_iso checks for keywords; we reuse it broadly
    iso_code = map_text_to_iso(text)
    if iso_code != "USA":  # USA is default, only add if explicitly explicit
        codes.add(iso_code)
    # Also check for common country name mentions
    country_keywords = {
        "india": "IND",
        "usa": "USA",
        "united states": "USA",
        "germany": "DEU",
        "germany": "DEU",
        "uk": "GBR",
        "united kingdom": "GBR",
        "britain": "GBR",
        "japan": "JPN",
    }
    for kw, code in country_keywords.items():
        if kw in lower:
            codes.add(code)
    return codes


def _compute_keyword_severity(text: str) -> float:
    """Compute severity [0.0, 1.0] from keyword matches in article text.

    Simple inflections count, so "crash" also catches "crashes" and "crashed",
    and "surge" catches "surging".
    """
    lower = text.lower()
    total = 0.0
    for kw, weight in SEVERITY_KEYWORDS.items():
        stem = re.escape(kw[:-1] if kw.endswith("e") else kw)
        if re.search(r"\b" + stem + r"(?:e|es|ed|s|d|ing)?\b", lower):
            total += weight
    # Two crisis-level hits saturate the score.
    return round(min(total / KEYWORD_SATURATION, 1.0), 4)


def _compute_source_credibility(source: str) -> float:
    """Map article source name to credibility weight."""
    src_lower = (source or "").lower()
    for key, weight in SOURCE_CREDIBILITY.items():
        if key in src_lower:
            return weight
    return SOURCE_CREDIBILITY["default"]  # 0.50


def _compute_recency_factor(published_at: Optional[str]) -> float:
    """
    Compute recency decay factor [0.0, 1.0] based on published_at timestamp.

    - A just-published article scores 1.0
    - The factor halves every RECENCY_HALF_LIFE_HOURS, floored at 0.5 so old news keeps some weight
    """
    if not published_at:
        return 0.7  # neutral: unknown age, assume moderate recency

    try:
        from datetime import datetime, timezone

        published_dt = datetime.fromisoformat(
            str(published_at).replace("Z", "+00:00")
        )
        if published_dt.tzinfo is None:
            published_dt = published_dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        elapsed_hours = max((now - published_dt).total_seconds() / 3600.0, 0.0)

        factor = 0.5 ** (elapsed_hours / RECENCY_HALF_LIFE_HOURS)
        return round(max(factor, 0.5), 4)
    except Exception as e:
        logger.warning(f"Error computing recency factor: {e}")
        return 0.7


def score_urgency(
    text: str,
    source: str = "default",
    published_at: Optional[str] = None,
    iso_mentioned: bool = False,
) -> dict[str, Any]:
    """
    Compute an urgency score [0.0, 1.0] for a news article.

    Formula components (weights sum to 1.0):
      1. Keyword severity:    up to 0.45
      2. Sentiment polarity:  up to 0.20 (bearish counts more than bullish)
      3. ISO mention:         up to 0.10
      4. Source credibility:  up to 0.10
      5. Recency:             up to 0.15

    Weighted sum clamped to [0.0, 1.0].

    Returns dict with:
      - urgency: float [0.0, 1.0]
      - severity_breakdown: dict of component contributions
      - urgency_color: "green" | "yellow" | "red" based on thresholds
    """

    try:
        # 1. Keyword severity
        kw_score = _compute_keyword_severity(text)
        kw_weighted = round(kw_score * WEIGHT_KEYWORDS, 4)

        # 2. Sentiment polarity, scaled by the classifier's confidence
        from services.ml_classifier.model.finbert_sentiment import classify_sentiment

        sent_result = classify_sentiment(text)
        if isinstance(sent_result, list):
            sent_result = sent_result[0] if sent_result else {}
        label = sent_result.get("label", "NEUTRAL")
        confidence = float(sent_result.get("score", 0.0) or 0.0)
        polarity_map = {"BEARISH": 1.0, "BULLISH": 0.6, "NEUTRAL": 0.1}
        sentiment_weight = polarity_map.get(label, 0.1) * (confidence if label != "NEUTRAL" else 1.0)
        sent_weighted = round(sentiment_weight * WEIGHT_SENTIMENT, 4)

        # 3. ISO mention boost
        iso_weighted = WEIGHT_ISO if iso_mentioned else 0.0

        # 4. Source credibility
        src_cred = _compute_source_credibility(source)
        src_weighted = round(src_cred * WEIGHT_SOURCE, 4)

        # 5. Recency factor
        recency = _compute_recency_factor(published_at)
        recency_weighted = round(recency * WEIGHT_RECENCY, 4)

        # Weighted sum
        total_urgency = round(
            kw_weighted + sent_weighted + iso_weighted + src_weighted + recency_weighted, 4
        )

        # Clamp to [0.0, 1.0]
        total_urgency = max(0.0, min(1.0, total_urgency))

        # Determine color-coded urgency status
        if total_urgency > 70 / 100:  # > 0.7
            urgency_color = "red"
        elif total_urgency > 40 / 100:  # 0.4 < score <= 0.7
            urgency_color = "yellow"
        else:  # score <= 0.4
            urgency_color = "green"

        severity_breakdown = {
            "keyword_severity": kw_weighted,
            "sentiment_polarity": sent_weighted,
            "iso_mention": iso_weighted,
            "source_credibility": src_weighted,
            "recency": recency_weighted,
        }

        logger.debug(
            f"Urgency scored: total={total_urgency:.4f} color={urgency_color} "
            f"breakdown={severity_breakdown}"
        )

        return {
            "urgency": total_urgency,
            "urgency_color": urgency_color,
            "severity_breakdown": severity_breakdown,
            "sentiment_label": label,
            "sentiment_score": sent_result.get("score", 0.0),
        }

    except Exception as e:
        logger.error(f"Urgency scoring error: {e}", exc_info=True)
        return {
            "urgency": 0.5,
            "urgency_color": "yellow",
            "severity_breakdown": {},
            "sentiment_label": "NEUTRAL",
            "sentiment_score": 0.0,
        }