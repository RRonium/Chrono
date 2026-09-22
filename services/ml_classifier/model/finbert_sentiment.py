"""FinBERT sentiment classification with CPU inference and batch optimization."""

import logging
import torch
from typing import Optional
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# Singleton model/cache to avoid re-loading on every call
_finit_model: Optional[AutoModelForSequenceClassification] = None
_finit_tokenizer: Optional[AutoTokenizer] = None
_finit_device: Optional[torch.device] = None
_finit_initialized = False


def _init_finit():
    """Initialize FinBERT model and tokenizer once (CPU-optimized)."""
    global _finit_model, _finit_tokenizer, _finit_device, _finit_initialized

    if _finit_initialized:
        return

    try:
        model_name = "ProsusAI/finbert"
        _finit_device = torch.device("cpu")

        _finit_tokenizer = AutoTokenizer.from_pretrained(model_name)
        _finit_model = AutoModelForSequenceClassification.from_pretrained(model_name).to(_finit_device)
        _finit_model.eval()  # eval mode disables dropout

        logger.info(f"FinBERT model loaded on device: {_finit_device} (vocab size: {_finit_model.config.vocab_size})")
        _finit_initialized = True
    except Exception as e:
        logger.error(f"Failed to load FinBERT model: {e}", exc_info=True)
        _finit_initialized = True  # prevent retry loop; fallback to stub below


_init_finit()


def classify_sentiment(texts: str | list[str]) -> list[dict[str, object]]:
    """
    Classify sentiment of one or more texts using FinBERT.

    Returns a list of dicts with keys: text, label (BULLISH/BEARISH/NEUTRAL), score (float [-1,1]).

    For batch inference: texts can be a list; results are returned in same order.
    CPU-optimized with torch.no_grad and batch dimension.
    """
    _init_finit()

    # Normalize to list
    if isinstance(texts, str):
        texts = [texts]
    elif not texts:
        return []

    # If model failed to load, return stub result
    if not _finit_initialized or _finit_model is None or _finit_tokenizer is None:
        return [
            {"text": t, "label": "neutral", "score": 0.0}
            for t in texts
        ]

    try:
        with torch.no_grad():
            # Tokenize with padding/truncation, batch together for efficiency
            inputs = _finit_tokenizer(
                texts,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt",
            ).to(_finit_device)

            # Forward pass
            outputs = _finit_model(**inputs)
            logits = outputs.logits

            # Convert logits to probabilities then to label/score
            probs = F.softmax(logits, dim=-1).cpu().numpy()

            # FinBERT label mapping: 0=negative, 1=neutral, 2=positive (check config)
            label_map = _finit_model.config.id2label if hasattr(_finit_model.config, "id2label") else {0: "negative", 1: "neutral", 2: "positive"}

            results = []
            for i, prob in enumerate(probs[0]):
                idx = int(prob.argmax())
                label = label_map.get(idx, "neutral")
                score = float(prob[idx])

                # Normalize to BULLISH/BEARISH/NEUTRAL mapping used across the system
                if label in ("positive",):
                    normalized_label = "BULLISH"
                elif label in ("negative",):
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
            {"text": t, "label": "neutral", "score": 0.0}
            for t in texts
        ]


def classify_sentiment_single(text: str) -> dict[str, object]:
    """Convenience wrapper for single-text classification returning a single dict."""
    results = classify_sentiment(text)
    return results[0] if results else {"text": text, "label": "neutral", "score": 0.0}