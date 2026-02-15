from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, AppColumnXref, DbColumn, DbTable
from ..schemas import ApplicationCreate, ApplicationDetail, ApplicationOut, ColumnBrief

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.get("", response_model=list[ApplicationOut])
def list_applications(search: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Application)
    if search:
        stmt = stmt.where(Application.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(Application.name)
    return db.scalars(stmt).all()


@router.post("", response_model=ApplicationOut, status_code=201)
def create_application(body: ApplicationCreate, db: Session = Depends(get_db)):
    app = Application(name=body.name, description=body.description)
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


@router.get("/{app_id}", response_model=ApplicationDetail)
def get_application(app_id: int, db: Session = Depends(get_db)):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")

    stmt = (
        select(AppColumnXref, DbColumn, DbTable)
        .join(DbColumn, AppColumnXref.column_id == DbColumn.id)
        .join(DbTable, DbColumn.table_id == DbTable.id)
        .where(AppColumnXref.application_id == app_id)
        .order_by(DbTable.table_name, DbColumn.column_name)
    )
    rows = db.execute(stmt).all()
    columns = [
        ColumnBrief(
            id=col.id,
            column_name=col.column_name,
            data_type=col.data_type,
            table_name=tbl.table_name,
            schema_name=tbl.schema_name,
            usage_type=xref.usage_type,
        )
        for xref, col, tbl in rows
    ]
    return ApplicationDetail(
        id=app.id,
        name=app.name,
        description=app.description,
        columns=columns,
    )
