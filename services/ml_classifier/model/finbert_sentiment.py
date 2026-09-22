"""FinBERT sentiment classification with CPU inference, batch optimization, and graceful fallback."""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Singleton model/cache to avoid re-loading on every call
_finit_model = None
_finit_tokenizer = None
_finit_device = None
_finit_initialized = False
_has_torch_transformers = False

try:
    import torch
    import torch.nn.functional as F
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    _has_torch_transformers = True
except ImportError:
    _has_torch_transformers = False


def _init_finit():
    """Initialize FinBERT model and tokenizer once (CPU-optimized)."""
    global _finit_model, _finit_tokenizer, _finit_device, _finit_initialized

    if _finit_initialized:
        return

    if not _has_torch_transformers:
        logger.warning("torch or transformers not available. Finbert sentiment will use heuristic fallback.")
        _finit_initialized = True
        return

    try:
        model_name = "ProsusAI/finbert"
        _finit_device = torch.device("cpu")

        _finit_tokenizer = AutoTokenizer.from_pretrained(model_name)
        _finit_model = AutoModelForSequenceClassification.from_pretrained(model_name).to(_finit_device)
        _finit_model.eval()

        logger.info(f"FinBERT model loaded on device: {_finit_device}")
        _finit_initialized = True
    except Exception as e:
        logger.warning(f"Failed to load FinBERT model (will use heuristic fallback): {e}")
        _finit_initialized = True


_init_finit()


def classify_sentiment(texts: str | list[str]) -> list[dict[str, object]]:
    """
    Classify sentiment of one or more texts using FinBERT or heuristic fallback.
    """
    _init_finit()

    if isinstance(texts, str):
        texts = [texts]
    elif not texts:
        return []

    # Fallback if model failed or torch/transformers not installed
    if not _has_torch_transformers or _finit_model is None or _finit_tokenizer is None:
        results = []
        for t in texts:
            lower = t.lower()
            if any(w in lower for w in ["surge", "rally", "record", "growth", "bull", "high", "gain", "profit", "beats"]):
                label, score = "BULLISH", 0.75
            elif any(w in lower for w in ["crash", "drop", "fall", "loss", "bear", "crisis", "inflation", "recession", "down"]):
                label, score = "BEARISH", 0.75
            else:
                label, score = "NEUTRAL", 0.50
            results.append({"text": t, "label": label, "score": score})
        return results

    try:
        with torch.no_grad():
            inputs = _finit_tokenizer(
                texts,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt",
            ).to(_finit_device)

            outputs = _finit_model(**inputs)
            logits = outputs.logits
            probs = F.softmax(logits, dim=-1).cpu().numpy()

            label_map = {0: "negative", 1: "neutral", 2: "positive"}
            results = []
            for i, prob in enumerate(probs):
                idx = int(prob.argmax())
                label = label_map.get(idx, "neutral")
                score = float(prob[idx])

                if label == "positive":
                    normalized_label = "BULLISH"
                elif label == "negative":
                    normalized_label = "BEARISH"
                else:
                    normalized_label = "NEUTRAL"

                results.append({
                    "text": texts[i] if i < len(texts) else "",
                    "label": normalized_label,
                    "score": round(score, 4),
                })

            return results

    except Exception as e:
        logger.error(f"FinBERT inference error: {e}", exc_info=True)
        return [
            {"text": t, "label": "NEUTRAL", "score": 0.0}
            for t in texts
        ]


def classify_sentiment_single(text: str) -> dict[str, object]:
    """Convenience wrapper for single-text classification returning a single dict."""
    results = classify_sentiment(text)
    return results[0] if results else {"text": text, "label": "NEUTRAL", "score": 0.0}
