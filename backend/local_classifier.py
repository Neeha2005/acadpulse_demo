import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_DIR = BASE_DIR / "ai" / "classifier" / "model"
DEFAULT_CONFIDENCE = float(os.getenv("LOCAL_CLASSIFIER_MIN_CONFIDENCE", "0.65"))
LABEL_ALIASES = {
    "LABEL_0": "announcement",
    "LABEL_1": "assignment",
    "LABEL_2": "event",
    "LABEL_3": "quiz",
    "LABEL_4": "noise",
}
ALLOWED_LABELS = {"announcement", "assignment", "event", "quiz", "noise"}


def get_local_classifier_path() -> Path:
    return Path(os.getenv("LOCAL_CLASSIFIER_PATH", str(DEFAULT_MODEL_DIR))).resolve()


def local_classifier_available() -> bool:
    model_dir = get_local_classifier_path()
    required_files = ["config.json", "tokenizer_config.json"]
    has_required_metadata = all((model_dir / file_name).exists() for file_name in required_files)
    has_weights = any(
        (model_dir / file_name).exists()
        for file_name in ("model.safetensors", "pytorch_model.bin")
    )
    return has_required_metadata and has_weights


def normalize_label(label: Optional[str]) -> Optional[str]:
    if not label:
        return None

    normalized = str(label).strip().lower().replace("-", "_").replace(" ", "_")
    if normalized in ALLOWED_LABELS:
        return normalized

    alias_value = LABEL_ALIASES.get(str(label).strip().upper())
    if alias_value:
        return alias_value

    for expected in ALLOWED_LABELS:
        if expected in normalized:
            return expected
    return None


@lru_cache(maxsize=1)
def get_local_classifier():
    if not local_classifier_available():
        return None

    try:
        from transformers import pipeline
    except ImportError:
        logger.warning("Local classifier unavailable because transformers is not installed")
        return None

    model_dir = get_local_classifier_path()
    try:
        return pipeline(
            "text-classification",
            model=str(model_dir),
            tokenizer=str(model_dir),
            truncation=True,
            max_length=256,
        )
    except Exception:
        logger.exception("Failed to load local XLM-R classifier from %s", model_dir)
        return None


def classify_with_local_model(text: str, min_confidence: float = DEFAULT_CONFIDENCE) -> Optional[Dict[str, object]]:
    if not text or not text.strip():
        return None

    classifier = get_local_classifier()
    if classifier is None:
        return None

    try:
        prediction = classifier(text[:4000])
        if isinstance(prediction, list):
            prediction = prediction[0] if prediction else None
        if not isinstance(prediction, dict):
            return None

        label = normalize_label(prediction.get("label"))
        score = float(prediction.get("score", 0) or 0)
        if label and score >= min_confidence:
            return {
                "label": label,
                "score": score,
                "source": "local_xlm_roberta",
            }
    except Exception:
        logger.exception("Local XLM-R classification failed")

    return None
