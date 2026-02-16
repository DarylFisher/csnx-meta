from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter()

GANTT_SQL = text("""
    SELECT
        COALESCE(c.customer_code, '__NONE__')  AS customer_code,
        COALESCE(c.description, 'No Customer') AS customer_description,
        p.project_id    AS project_id,
        p.project_name  AS project_name,
        p.color         AS color,
        p.status        AS project_status,
        d.drop_number   AS drop_number,
        d.start_date    AS start_date,
        d.end_date      AS end_date,
        d.status        AS drop_status
    FROM pmopt.projects p
    LEFT JOIN pmopt.customers c ON c.customer_id = p.customer_id
    LEFT JOIN pmopt.drops     d ON d.project_id = p.project_id
    WHERE p.status IN ('active', 'paused')
    ORDER BY customer_code, p.project_name, d.drop_number
""")


@router.get("/gantt")
def get_gantt(db: Session = Depends(get_db)):
    rows = db.execute(GANTT_SQL).mappings().all()

    customers: dict[str, dict] = {}

    for row in rows:
        code = row["customer_code"]
        if code not in customers:
            customers[code] = {
                "customer_code": code if code != "__NONE__" else None,
                "customer_description": row["customer_description"],
                "projects": {},
            }

        proj_id = str(row["project_id"])
        proj_map = customers[code]["projects"]
        if proj_id not in proj_map:
            proj_map[proj_id] = {
                "project_id": proj_id,
                "project_name": row["project_name"],
                "color": row["color"],
                "status": row["project_status"],
                "drops": [],
            }

        if row["drop_number"] is not None:
            proj_map[proj_id]["drops"].append(
                {
                    "drop_number": row["drop_number"],
                    "start_date": row["start_date"].isoformat() if row["start_date"] else None,
                    "end_date": row["end_date"].isoformat() if row["end_date"] else None,
                    "status": row["drop_status"],
                }
            )

    result = []
    for cust in customers.values():
        result.append(
            {
                "customer_code": cust["customer_code"],
                "customer_description": cust["customer_description"],
                "projects": list(cust["projects"].values()),
            }
        )

    return result
