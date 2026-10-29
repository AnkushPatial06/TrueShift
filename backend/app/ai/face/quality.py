"""
Quality gate applied to every captured face crop before it's embedded and
stored. Implements the spec's requirement to reject:
  - No face / multiple faces (handled in the endpoint layer via detector count)
  - Poor quality (too dark/bright, too small)
  - Excessive blur
"""
from dataclasses import dataclass

import cv2
import numpy as np

MIN_FACE_SIZE_PX = 90
BLUR_THRESHOLD = 60.0          # Variance of Laplacian; lower = blurrier
MIN_MEAN_BRIGHTNESS = 40.0     # 0-255 grayscale scale
MAX_MEAN_BRIGHTNESS = 220.0


@dataclass
class QualityReport:
    passed: bool
    reasons: list[str]
    blur_score: float
    brightness: float


def assess_quality(face_crop: np.ndarray) -> QualityReport:
    reasons: list[str] = []

    h, w = face_crop.shape[:2]
    if w < MIN_FACE_SIZE_PX or h < MIN_FACE_SIZE_PX:
        reasons.append(f"Face too small ({w}x{h}px) — move closer to the camera")

    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)

    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if blur_score < BLUR_THRESHOLD:
        reasons.append("Image is too blurry — hold the camera steady")

    brightness = float(gray.mean())
    if brightness < MIN_MEAN_BRIGHTNESS:
        reasons.append("Image is too dark — move to better lighting")
    elif brightness > MAX_MEAN_BRIGHTNESS:
        reasons.append("Image is overexposed — reduce direct light/glare")

    return QualityReport(
        passed=len(reasons) == 0,
        reasons=reasons,
        blur_score=blur_score,
        brightness=brightness,
    )
