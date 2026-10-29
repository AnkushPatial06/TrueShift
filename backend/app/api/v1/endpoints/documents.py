import os, uuid, shutil
from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.document import EmployeeDocument
from app.models.user import User

router = APIRouter(prefix="/documents", tags=["Documents"])

UPLOAD_DIR = os.path.join("data", "uploads", "documents")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB

def _out(d: EmployeeDocument) -> dict:
    return {"id": d.id, "file_name": d.original_name, "file_type": d.file_type, "file_size": d.file_size, "file_url": d.file_url, "created_at": d.created_at.isoformat()}

@router.get("/mine")
async def my_documents(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(EmployeeDocument).where(EmployeeDocument.employee_id == current_user.id).order_by(EmployeeDocument.created_at.desc())
    result = await session.execute(stmt)
    return [_out(d) for d in result.scalars().all()]

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        from app.core.exceptions import AppError
        raise AppError("File type not allowed. Upload PDF, JPEG, PNG, or Word documents.")
    content = await file.read()
    if len(content) > MAX_SIZE:
        from app.core.exceptions import AppError
        raise AppError("File too large. Maximum size is 10MB.")
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, unique_name)
    with open(path, "wb") as f:
        f.write(content)
    doc = EmployeeDocument(
        employee_id=current_user.id, file_name=unique_name, original_name=file.filename,
        file_type=file.content_type, file_size=len(content),
        file_url=f"/api/v1/documents/{0}/download",  # will be updated after insert
        uploaded_by=current_user.id,
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    doc.file_url = f"/api/v1/documents/{doc.id}/download"
    await session.commit()
    return _out(doc)

@router.get("/{doc_id}/download")
async def download_document(
    doc_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await session.get(EmployeeDocument, doc_id)
    if not doc:
        raise NotFoundError("Document not found")
    if doc.employee_id != current_user.id and current_user.role not in ("admin", "hr"):
        raise PermissionDeniedError("Not authorized")
    path = os.path.join(UPLOAD_DIR, doc.file_name)
    if not os.path.exists(path):
        raise NotFoundError("File not found on disk")
    return FileResponse(path, filename=doc.original_name, media_type=doc.file_type)

@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await session.get(EmployeeDocument, doc_id)
    if not doc:
        raise NotFoundError("Document not found")
    if doc.employee_id != current_user.id and current_user.role not in ("admin", "hr"):
        raise PermissionDeniedError("Not authorized")
    path = os.path.join(UPLOAD_DIR, doc.file_name)
    if os.path.exists(path):
        os.remove(path)
    await session.delete(doc)
    await session.commit()
