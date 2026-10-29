"""
Practical first-version liveness check per the spec:
  - Blink detection (eye-aspect-ratio dip across frames)
  - Head movement (nose-tip displacement across frames)
  - Multi-frame verification (requires >=3 frames, not a single photo)

Uses MediaPipe FaceMesh, whose model weights ship inside the pip package
itself — no external download required, so this works fully offline.

Architecture note: this module exposes a single `check_liveness(frames)`
entry point so a dedicated anti-spoofing model (e.g. a trained CNN classifier)
can be swapped in later without touching the attendance engine or endpoints
that call it.
"""
from dataclasses import dataclass

import cv2
import mediapipe as mp
import numpy as np

MIN_FRAMES_FOR_LIVENESS = 3

# EAR (eye aspect ratio) drops sharply during a blink; a healthy open eye is
# typically 0.25-0.35, closed is <0.15-0.18 depending on face/camera.
EAR_BLINK_THRESHOLD = 0.19
MIN_HEAD_MOVEMENT_PX = 4.0  # minimum nose displacement across frames to prove it's not a static photo

_mp_face_mesh = mp.solutions.face_mesh

# MediaPipe FaceMesh landmark indices for eye corners/lids (468-point model)
LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]
NOSE_TIP = 1


@dataclass
class LivenessResult:
    is_live: bool
    blink_detected: bool
    head_movement_detected: bool
    reason: str | None = None


def _eye_aspect_ratio(landmarks, indices, image_w, image_h) -> float:
    pts = np.array([(landmarks[i].x * image_w, landmarks[i].y * image_h) for i in indices])
    vertical_1 = np.linalg.norm(pts[1] - pts[5])
    vertical_2 = np.linalg.norm(pts[2] - pts[4])
    horizontal = np.linalg.norm(pts[0] - pts[3])
    if horizontal == 0:
        return 0.0
    return (vertical_1 + vertical_2) / (2.0 * horizontal)


def check_liveness(frames: list[np.ndarray]) -> LivenessResult:
    """
    frames: a short burst of consecutive BGR frames (webcam captures), most
    recent last. Requires at least MIN_FRAMES_FOR_LIVENESS frames.
    """
    if len(frames) < MIN_FRAMES_FOR_LIVENESS:
        return LivenessResult(
            is_live=False, blink_detected=False, head_movement_detected=False,
            reason=f"Need at least {MIN_FRAMES_FOR_LIVENESS} frames for liveness verification",
        )

    ear_series: list[float] = []
    nose_positions: list[tuple[float, float]] = []

    with _mp_face_mesh.FaceMesh(
        static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.5
    ) as face_mesh:
        for frame in frames:
            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = face_mesh.process(rgb)
            if not result.multi_face_landmarks:
                continue

            landmarks = result.multi_face_landmarks[0].landmark
            left_ear = _eye_aspect_ratio(landmarks, LEFT_EYE, w, h)
            right_ear = _eye_aspect_ratio(landmarks, RIGHT_EYE, w, h)
            ear_series.append((left_ear + right_ear) / 2.0)

            nose = landmarks[NOSE_TIP]
            nose_positions.append((nose.x * w, nose.y * h))

    if len(ear_series) < MIN_FRAMES_FOR_LIVENESS:
        return LivenessResult(
            is_live=False, blink_detected=False, head_movement_detected=False,
            reason="Could not consistently detect facial landmarks across frames",
        )

    blink_detected = min(ear_series) < EAR_BLINK_THRESHOLD

    max_displacement = 0.0
    for i in range(1, len(nose_positions)):
        dx = nose_positions[i][0] - nose_positions[0][0]
        dy = nose_positions[i][1] - nose_positions[0][1]
        max_displacement = max(max_displacement, (dx**2 + dy**2) ** 0.5)
    head_movement_detected = max_displacement >= MIN_HEAD_MOVEMENT_PX

    is_live = blink_detected or head_movement_detected
    reason = None if is_live else "No blink or head movement detected — possible static photo/spoof attempt"

    return LivenessResult(
        is_live=is_live,
        blink_detected=blink_detected,
        head_movement_detected=head_movement_detected,
        reason=reason,
    )
