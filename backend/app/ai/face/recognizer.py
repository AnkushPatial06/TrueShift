"""
Recognition step: given a live camera frame, find which (if any) registered
employee it belongs to, using Qdrant similarity search over stored ArcFace
embeddings.
"""
from dataclasses import dataclass

import numpy as np

from app.ai.face.detector import detect_faces
from app.ai.face.embedder import generate_embedding
from app.vector.qdrant_store import FaceVectorStore

# Cosine similarity threshold above which we trust the match. ArcFace cosine
# similarity for the same identity is typically > 0.5-0.6; different
# identities usually score much lower. Tune this against real data.
SIMILARITY_THRESHOLD = 0.55


@dataclass
class RecognitionResult:
    matched: bool
    employee_id: str | None
    similarity_score: float | None
    reason: str | None = None


def recognize_face(image: np.ndarray) -> RecognitionResult:
    detection = detect_faces(image)

    if detection.count == 0:
        return RecognitionResult(matched=False, employee_id=None, similarity_score=None, reason="No face detected")
    if detection.count > 1:
        return RecognitionResult(matched=False, employee_id=None, similarity_score=None, reason="Multiple faces detected")

    face = detection.single_face
    crop = face.crop(image)

    embedding = generate_embedding(crop)
    if embedding is None:
        return RecognitionResult(matched=False, employee_id=None, similarity_score=None, reason="Could not extract embedding")

    store = FaceVectorStore()
    matches = store.search(embedding, limit=1)
    if not matches:
        return RecognitionResult(matched=False, employee_id=None, similarity_score=None, reason="No registered faces to compare against")

    best = matches[0]
    if best["score"] < SIMILARITY_THRESHOLD:
        return RecognitionResult(
            matched=False, employee_id=None, similarity_score=best["score"],
            reason="Face does not match any registered employee with sufficient confidence",
        )

    return RecognitionResult(matched=True, employee_id=best["employee_id"], similarity_score=best["score"])
