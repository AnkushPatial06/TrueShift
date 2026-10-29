"""
Qdrant connection manager.

Two collections are kept strictly separate:
1. face_embeddings       -> face recognition
2. hr_policy_embeddings  -> reserved for Phase 8 RAG
"""

import logging

from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    PayloadSchemaType,
    VectorParams,
)

from app.core.config import get_settings


logger = logging.getLogger("app.qdrant")

settings = get_settings()

# ============================================================
# Collection names
# ============================================================

FACE_COLLECTION = "face_embeddings"

# Reserved for Phase 8 RAG
HR_POLICY_COLLECTION = "hr_policy_embeddings"


# ============================================================
# Face embedding configuration
# ============================================================

# ArcFace / InsightFace buffalo_l produces 512-dimensional vectors.
FACE_EMBEDDING_DIM = 512


# ============================================================
# Qdrant manager
# ============================================================

class QdrantManager:
    client: QdrantClient | None = None


qdrant_manager = QdrantManager()


# ============================================================
# Connect to Qdrant
# ============================================================

def connect_to_qdrant() -> None:
    """
    Connect to Qdrant and make sure the face_embeddings
    collection and required payload indexes exist.
    """

    if not settings.QDRANT_URL:
        logger.warning(
            "QDRANT_URL is not set — face registration/recognition "
            "endpoints will fail until it is configured in .env"
        )
        return

    # --------------------------------------------------------
    # Create Qdrant client
    # --------------------------------------------------------

    qdrant_manager.client = QdrantClient(
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY or None,
    )

    # --------------------------------------------------------
    # Ensure face collection exists
    # --------------------------------------------------------

    _ensure_collection(
        FACE_COLLECTION,
        FACE_EMBEDDING_DIM,
    )

    # --------------------------------------------------------
    # Ensure employee_id payload index exists
    # --------------------------------------------------------

    _ensure_employee_id_index()

    logger.info(
        "Connected to Qdrant and ensured '%s' collection and "
        "employee_id index exist",
        FACE_COLLECTION,
    )


# ============================================================
# Ensure collection exists
# ============================================================

def _ensure_collection(name: str, dim: int) -> None:
    """
    Create the collection if it does not already exist.
    """

    client = qdrant_manager.client

    if client is None:
        raise RuntimeError(
            "Qdrant client is not initialized."
        )

    existing = [
        collection.name
        for collection in client.get_collections().collections
    ]

    if name not in existing:

        logger.info(
            "Creating Qdrant collection '%s'",
            name,
        )

        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(
                size=dim,
                distance=Distance.COSINE,
            ),
        )

        logger.info(
            "Created Qdrant collection '%s'",
            name,
        )


# ============================================================
# Ensure employee_id payload index
# ============================================================

def _ensure_employee_id_index() -> None:
    """
    Make sure employee_id has a KEYWORD payload index.

    This index is required because face registration and
    re-registration filter Qdrant points using employee_id.
    """

    client = qdrant_manager.client

    if client is None:
        raise RuntimeError(
            "Qdrant client is not initialized."
        )

    logger.info(
        "Ensuring Qdrant payload index for 'employee_id'"
    )

    client.create_payload_index(
        collection_name=FACE_COLLECTION,
        field_name="employee_id",
        field_schema=PayloadSchemaType.KEYWORD,
    )

    logger.info(
        "Qdrant payload index for 'employee_id' is ready"
    )


# ============================================================
# Get Qdrant client
# ============================================================

def get_qdrant_client() -> QdrantClient:
    """
    Return the active Qdrant client.
    """

    if qdrant_manager.client is None:
        raise RuntimeError(
            "Qdrant is not configured. Set QDRANT_URL "
            "(and QDRANT_API_KEY if using Qdrant Cloud) "
            "in backend/.env, then restart the server."
        )

    return qdrant_manager.client