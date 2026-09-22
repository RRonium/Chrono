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

# ISO code matching in text boosts urgency
ISO_BOOST_WEIGHT = 0.15  # +0.15 if ISO country mentioned in article text

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
    """Compute severity score based on keyword matches in article text."""
    lower = text.lower()
    total = 0.0
    matched: list[str] = []
    for kw, weight in SEVERITY_KEYWORDS.items():
        # match whole word or phrase; word-boundary for single words
        pattern = r"\b" + re.escape(kw) + r"\b" if len(kw) > 2 else kw
        if re.search(pattern, lower):
            total += weight
            matched.append(kw)
    # Cap at 0.6 to avoid over-weighting single articles
    return round(min(total, 0.6), 4)


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

    - If published_at is within the last RECENCY_HALF_LIFE_HOURS, factor near 1.0
    - After half-life, factor decays toward 0.5 (not to 0, since old news still has relevance)
    - Uses exponential decay: factor = 1 - (0.5 ** (elapsed_hours / half_life))
    """
    if not published_at:
        return 0.7  # neutral: unknown age, assume moderate recency

    try:
        from datetime import datetime, timezone

        published_dt = datetime.fromisoformat(
            published_at.replace("Z", "+00:00")
        ).astimezone(timezone.utc)
        now = datetime.now(timezone.utc)
        elapsed_hours = max((now - published_dt).total_seconds() / 3600.0, 0.0)

        # Exponential decay based on half-life
        # After N half-lives, factor approaches 0.5
        decay = 0.5 ** (elapsed_hours / RECENCY_HALF_LIFE_HOURS)
        factor = 1.0 - decay  # ranges from 1.0 (fresh) to 0.5 (stale)
        return round(max(factor, 0.5), 4)  # floor at 0.5
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

    Formula components:
      1. Keyword severity:    up to 0.35 weight
      2. Sentiment polarity:  up to 0.25 weight
      3. ISO mention:         up to 0.15 weight
      4. Source credibility:  up to 0.20 weight
      5. Recency:             up to 0.15 weight

    Weighted sum clamped to [0.0, 1.0].

    Returns dict with:
      - urgency: float [0.0, 1.0]
      - severity_breakdown: dict of component contributions
      - urgency_color: "green" | "yellow" | "red" based on thresholds
    """

    try:
        # 1. Keyword severity (max weight 0.35)
        kw_score = _compute_keyword_severity(text)
        kw_weighted = round(kw_score * 0.35, 4)

        # 2. Sentiment polarity (max weight 0.25)
        from services.ml_classifier.model.finbert_sentiment import classify_sentiment

        sent_result = classify_sentiment(text)
        label = sent_result.get("label", "NEUTRAL") if isinstance(sent_result, dict) else sent_result[0].get(
            "label", "NEUTRAL"
        ) if isinstance(sent_result, list) else "NEUTRAL"
        sent_score_map = {"BULLISH": 0.15, "BEARISH": 0.20, "NEUTRAL": 0.05}
        sentiment_weight = sent_score_map.get(label, 0.05)
        sent_weighted = round(sentiment_weight * 0.25, 4)

        # 3. ISO mention boost (max weight 0.15)
        iso_boost = ISO_BOOST_WEIGHT if iso_mentioned else 0.0
        iso_weighted = round(iso_boost * 1.0, 4)  # full weight if mentioned

        # 4. Source credibility (max weight 0.20)
        src_cred = _compute_source_credibility(source)
        src_weighted = round(src_cred * 0.20, 4)

        # 5. Recency factor (max weight 0.15)
        recency = _compute_recency_factor(published_at)
        recency_weighted = round(recency * 0.15, 4)

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
            "sentiment_score": sent_result.get("score", 0.0) if isinstance(sent_result, dict) else sent_result[0].get(
                "score", 0.0
            )
            if isinstance(sent_result, (dict, list))
            else 0.0,
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