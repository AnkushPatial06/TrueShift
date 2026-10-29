"""
Face detection using OpenCV's Haar Cascade classifiers, which ship bundled
inside the opencv-python wheel (cv2.data.haarcascades) — no separate model
download needed.

Uses the frontal-face cascade first, then falls back to the profile-face
cascade (checking both the original and a horizontally-mirrored copy, since
the profile cascade is only trained on left-facing profiles) so that
slightly turned left/right angles are still detected.
"""
from dataclasses import dataclass

import cv2
import numpy as np

_face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
_profile_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_profileface.xml"
)


@dataclass
class DetectedFace:
    x: int
    y: int
    w: int
    h: int

    def crop(self, image: np.ndarray) -> np.ndarray:
        return image[self.y : self.y + self.h, self.x : self.x + self.w]


class FaceDetectionResult:
    def __init__(self, faces: list[DetectedFace]):
        self.faces = faces

    @property
    def count(self) -> int:
        return len(self.faces)

    @property
    def single_face(self) -> DetectedFace | None:
        return self.faces[0] if self.count == 1 else None


def _run_cascade(cascade, gray) -> list:
    return cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(80, 80))


def detect_faces(image: np.ndarray) -> FaceDetectionResult:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    detections = _run_cascade(_face_cascade, gray)

    if len(detections) == 0:
        # Try profile cascade — catches faces turned left
        detections = _run_cascade(_profile_cascade, gray)

    if len(detections) == 0:
        # Try profile cascade on a mirrored image — catches faces turned right
        flipped = cv2.flip(gray, 1)
        flipped_detections = _run_cascade(_profile_cascade, flipped)
        width = gray.shape[1]
        detections = [
            (width - x - w, y, w, h) for (x, y, w, h) in flipped_detections
        ]

    faces = [DetectedFace(int(x), int(y), int(w), int(h)) for (x, y, w, h) in detections]
    return FaceDetectionResult(faces)