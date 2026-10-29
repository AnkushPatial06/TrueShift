"""
Implements the registration workflow: detect -> quality check -> embed ->
store in Qdrant -> store registration metadata in MySQL. Never stores the
raw image — only the numeric embedding goes to Qdrant.
"""
import base64
import binascii

import cv2
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.face.detector import detect_faces
from app.ai.face.embedder import generate_embedding
from app.ai.face.quality import assess_quality
from app.core.exceptions import AppError, NotFoundError
from app.repositories.user_repository import UserRepository
from app.schemas.face import FaceRegistrationRequest, FrameResult
from app.vector.qdrant_store import FaceVectorStore

MIN_ACCEPTED_ANGLES = 2


def _decode_base64_image(image_base64: str) -> np.ndarray:
    try:
        if "," in image_base64[:40]:
            image_base64 = image_base64.split(",", 1)[1]
        raw = base64.b64decode(image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AppError("One of the frames is not valid base64 image data") from exc

    array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise AppError("One of the frames could not be decoded as an image")
    return image


async def _resolve_user(users: UserRepository, employee_id_str: str):
    if employee_id_str.isdigit():
        user = await users.find_by_id(int(employee_id_str))
        if user:
            return user
    return await users.find_by_employee_id(employee_id_str)


class FaceRegistrationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepository(session)

    async def register(self, payload: FaceRegistrationRequest) -> dict:
        user = await _resolve_user(self.users, payload.employee_id)
        if not user:
            raise NotFoundError("No employee matches this employee_id")

        store = FaceVectorStore()
        store.delete_employee_embeddings(str(user.id))

        frame_results: list[FrameResult] = []
        accepted = 0

        for frame in payload.frames:
            image = _decode_base64_image(frame.image_base64)
            detection = detect_faces(image)

            if detection.count == 0:
                frame_results.append(FrameResult(angle=frame.angle, accepted=False, reasons=["No face detected"]))
                continue
            if detection.count > 1:
                frame_results.append(FrameResult(angle=frame.angle, accepted=False, reasons=["Multiple faces detected"]))
                continue

            face = detection.single_face
            crop = face.crop(image)
            quality = assess_quality(crop)
            if not quality.passed:
                frame_results.append(FrameResult(angle=frame.angle, accepted=False, reasons=quality.reasons))
                continue

            embedding = generate_embedding(crop)
            if embedding is None:
                frame_results.append(
                    FrameResult(angle=frame.angle, accepted=False, reasons=["Could not extract a face embedding"])
                )
                continue

            store.upsert_embedding(str(user.id), embedding, frame.angle)
            frame_results.append(FrameResult(angle=frame.angle, accepted=True))
            accepted += 1

        face_registered = accepted >= MIN_ACCEPTED_ANGLES
        await self.users.set_face_registered(user.id, face_registered)

        return {
            "employee_id": payload.employee_id,
            "accepted_angles": accepted,
            "required_angles": MIN_ACCEPTED_ANGLES,
            "face_registered": face_registered,
            "frame_results": frame_results,
        }

    async def status(self, employee_id: str) -> dict:
        user = await _resolve_user(self.users, employee_id)
        if not user:
            raise NotFoundError("No employee matches this employee_id")

        store = FaceVectorStore()
        angle_count = store.count_for_employee(str(user.id))
        return {
            "employee_id": employee_id,
            "face_registered": user.face_registered,
            "angles_captured": angle_count,
        }

    async def remove(self, employee_id: str) -> None:
        user = await _resolve_user(self.users, employee_id)
        if not user:
            raise NotFoundError("No employee matches this employee_id")
        store = FaceVectorStore()
        store.delete_employee_embeddings(str(user.id))
        await self.users.set_face_registered(user.id, False)
