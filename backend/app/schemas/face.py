from pydantic import BaseModel, Field


class FaceFrameInput(BaseModel):
    angle: str = Field(description="e.g. 'front', 'left', 'right'")
    image_base64: str = Field(description="Base64-encoded JPEG/PNG frame")


class FaceRegistrationRequest(BaseModel):
    employee_id: str
    frames: list[FaceFrameInput] = Field(min_length=1, max_length=6)


class FrameResult(BaseModel):
    angle: str
    accepted: bool
    reasons: list[str] = []


class FaceRegistrationResponse(BaseModel):
    employee_id: str
    accepted_angles: int
    required_angles: int
    face_registered: bool
    frame_results: list[FrameResult]


class FaceStatusResponse(BaseModel):
    employee_id: str
    face_registered: bool
    angles_captured: int
