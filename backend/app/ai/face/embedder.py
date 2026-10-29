"""
Generates the 512-dimensional ArcFace embedding used for both registration
and recognition. Uses InsightFace's `buffalo_l` model pack.

IMPORTANT — first-run model download:
InsightFace downloads its ONNX model weights (~300MB) from its model zoo the
first time FaceEmbedder() is constructed on a machine with internet access.
This happens once and is then cached locally (~/.insightface/models). It
will NOT work in fully offline/sandboxed environments — make sure the
machine running this backend has internet access at least once.
"""
import logging
import threading

import numpy as np
from insightface.app import FaceAnalysis

logger = logging.getLogger("app.ai.face.embedder")

_lock = threading.Lock()
_app_instance: FaceAnalysis | None = None


def _get_app() -> FaceAnalysis:
    """Lazily initializes the InsightFace app (expensive) exactly once."""
    global _app_instance
    if _app_instance is None:
        with _lock:
            if _app_instance is None:
                logger.info("Loading InsightFace buffalo_l model pack (first call only)...")
                app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
                app.prepare(ctx_id=0, det_size=(320, 320))
                _app_instance = app
    return _app_instance


def generate_embedding(face_crop_bgr: np.ndarray) -> list[float] | None:
    """
    Runs InsightFace's own detector+embedder on an already-cropped face image
    and returns a normalized 512-d embedding, or None if InsightFace itself
    couldn't find a usable face in the crop (extra safety net beyond our
    Haar Cascade + quality checks).
    """
    app = _get_app()
    faces = app.get(face_crop_bgr)
    if not faces:
        return None

    # If more than one face is found inside the crop (shouldn't normally
    # happen since we already cropped to one detection), take the largest.
    best = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    embedding = best.normed_embedding  # already L2-normalized, ideal for cosine similarity
    return embedding.astype(float).tolist()
