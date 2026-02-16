from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter()

PROJECTS_SQL = text("""
    SELECT
        p.project_id,
        p.project_name,
        COALESCE(c.customer_code, 'No Customer') AS customer_code,
        COALESCE(c.description, 'No Customer') AS customer_description
    FROM pmopt.projects p
    LEFT JOIN pmopt.customers c ON c.customer_id = p.customer_id
    WHERE p.status IN ('active', 'paused')
    ORDER BY c.customer_code, p.project_name
""")

TASKS_SQL = text("""
    SELECT
        t.task_id,
        t.task_description,
        t.status,
        t.assigned_resource,
        t.resource_type,
        t.estimated_duration,
        t.start_date,
        t.end_date,
        t.baseline_start_date,
        t.baseline_end_date,
        t.drop_number,
        t.jira_key
    FROM pmopt.tasks t
    WHERE t.project_id = :project_id
    ORDER BY t.drop_number, t.task_id
""")


@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    rows = db.execute(PROJECTS_SQL).mappings().all()
    return [
        {
            "project_id": r["project_id"],
            "project_name": r["project_name"],
            "customer_code": r["customer_code"],
            "customer_description": r["customer_description"],
        }
        for r in rows
    ]


@router.get("/projects/{project_id}/tasks")
def get_project_tasks(project_id: str, db: Session = Depends(get_db)):
    rows = db.execute(TASKS_SQL, {"project_id": project_id}).mappings().all()
    return [
        {
            "task_id": r["task_id"],
            "description": r["task_description"],
            "status": r["status"],
            "resource": r["assigned_resource"],
            "resource_type": r["resource_type"],
            "duration": r["estimated_duration"],
            "start_date": r["start_date"].isoformat() if r["start_date"] else None,
            "end_date": r["end_date"].isoformat() if r["end_date"] else None,
            "baseline_start_date": r["baseline_start_date"].isoformat() if r["baseline_start_date"] else None,
            "baseline_end_date": r["baseline_end_date"].isoformat() if r["baseline_end_date"] else None,
            "drop_number": r["drop_number"],
            "jira_key": r["jira_key"],
        }
        for r in rows
    ]
