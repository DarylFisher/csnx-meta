from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter()

COMMITMENTS_SQL = text("""
    SELECT commitment_id, description, resource_type,
           start_date, end_date, resource_count, color
    FROM pmopt.commitments
    ORDER BY start_date, resource_type
""")


@router.get("/commitments")
def get_commitments(db: Session = Depends(get_db)):
    rows = db.execute(COMMITMENTS_SQL).mappings().all()
    return [
        {
            "commitment_id": row["commitment_id"],
            "description": row["description"],
            "resource_type": row["resource_type"],
            "start_date": row["start_date"].isoformat(),
            "end_date": row["end_date"].isoformat(),
            "resource_count": row["resource_count"],
            "color": row["color"],
        }
        for row in rows
    ]
