"""
Thin repository-style wrapper around Qdrant for the face_embeddings collection.
Keeps Qdrant-specific query syntax out of the face recognition service.
"""
import uuid
from typing import Any

from qdrant_client.http.models import FieldCondition, Filter, MatchValue, PointStruct

from app.core.qdrant import FACE_COLLECTION, get_qdrant_client


class FaceVectorStore:
    def __init__(self):
        self.client = get_qdrant_client()
        self.collection = FACE_COLLECTION

    def upsert_embedding(self, employee_id: str, embedding: list[float], angle_label: str) -> str:
        """Stores one embedding (one captured angle) tagged with the owning employee_id."""
        point_id = str(uuid.uuid4())
        self.client.upsert(
            collection_name=self.collection,
            points=[
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={"employee_id": employee_id, "angle": angle_label},
                )
            ],
        )
        return point_id

    def search(self, embedding: list[float], limit: int = 3) -> list[dict[str, Any]]:
        """Returns the closest matches across ALL employees, each with a similarity score."""
        results = self.client.query_points(
            collection_name=self.collection,
            query=embedding,
            limit=limit,
            with_payload=True,
        ).points

        return [
            {
                "employee_id": r.payload["employee_id"],
                "score": r.score,
                "angle": r.payload.get("angle"),
            }
            for r in results
        ]

    def delete_employee_embeddings(self, employee_id: str) -> None:
        """Removes all stored angles for one employee (used on re-registration)."""
        self.client.delete(
            collection_name=self.collection,
            points_selector=Filter(
                must=[FieldCondition(key="employee_id", match=MatchValue(value=employee_id))]
            ),
        )

    def count_for_employee(self, employee_id: str) -> int:
        result = self.client.count(
            collection_name=self.collection,
            count_filter=Filter(
                must=[FieldCondition(key="employee_id", match=MatchValue(value=employee_id))]
            ),
        )
        return result.count