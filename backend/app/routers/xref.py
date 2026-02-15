from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AppColumnXref, Application, DbColumn, DbTable
from ..schemas import SearchResult, XrefCreate, XrefDetail, XrefOut

router = APIRouter(prefix="/api", tags=["cross-references"])


@router.post("/xref", response_model=XrefOut, status_code=201)
def create_xref(body: XrefCreate, db: Session = Depends(get_db)):
    xref = AppColumnXref(
        application_id=body.application_id,
        column_id=body.column_id,
        usage_type=body.usage_type,
    )
    db.add(xref)
    db.commit()
    db.refresh(xref)
    return xref


@router.delete("/xref/{xref_id}", status_code=204)
def delete_xref(xref_id: int, db: Session = Depends(get_db)):
    xref = db.get(AppColumnXref, xref_id)
    if not xref:
        raise HTTPException(404, "Xref not found")
    db.delete(xref)
    db.commit()


@router.get("/xref/by-app/{app_id}", response_model=list[XrefDetail])
def xref_by_app(app_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(AppColumnXref, Application, DbColumn, DbTable)
        .join(Application, AppColumnXref.application_id == Application.id)
        .join(DbColumn, AppColumnXref.column_id == DbColumn.id)
        .join(DbTable, DbColumn.table_id == DbTable.id)
        .where(AppColumnXref.application_id == app_id)
        .order_by(DbTable.table_name, DbColumn.column_name)
    )
    rows = db.execute(stmt).all()
    return [
        XrefDetail(
            id=xref.id,
            application_id=xref.application_id,
            column_id=xref.column_id,
            usage_type=xref.usage_type,
            application_name=app.name,
            column_name=col.column_name,
            table_name=tbl.table_name,
            schema_name=tbl.schema_name,
        )
        for xref, app, col, tbl in rows
    ]


@router.get("/xref/by-column/{col_id}", response_model=list[XrefDetail])
def xref_by_column(col_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(AppColumnXref, Application, DbColumn, DbTable)
        .join(Application, AppColumnXref.application_id == Application.id)
        .join(DbColumn, AppColumnXref.column_id == DbColumn.id)
        .join(DbTable, DbColumn.table_id == DbTable.id)
        .where(AppColumnXref.column_id == col_id)
        .order_by(Application.name)
    )
    rows = db.execute(stmt).all()
    return [
        XrefDetail(
            id=xref.id,
            application_id=xref.application_id,
            column_id=xref.column_id,
            usage_type=xref.usage_type,
            application_name=app.name,
            column_name=col.column_name,
            table_name=tbl.table_name,
            schema_name=tbl.schema_name,
        )
        for xref, app, col, tbl in rows
    ]


@router.get("/search", response_model=list[SearchResult])
def unified_search(q: str, db: Session = Depends(get_db)):
    results: list[SearchResult] = []
    like = f"%{q}%"

    # Applications
    apps = db.scalars(
        select(Application).where(
            or_(Application.name.ilike(like), Application.description.ilike(like))
        )
    ).all()
    for a in apps:
        results.append(SearchResult(type="application", id=a.id, name=a.name, detail=a.description))

    # Tables
    tables = db.scalars(
        select(DbTable).where(
            or_(DbTable.table_name.ilike(like), DbTable.description.ilike(like))
        )
    ).all()
    for t in tables:
        results.append(SearchResult(
            type="table", id=t.id, name=f"{t.schema_name}.{t.table_name}", detail=t.description,
        ))

    # Columns
    cols = db.execute(
        select(DbColumn, DbTable)
        .join(DbTable, DbColumn.table_id == DbTable.id)
        .where(or_(DbColumn.column_name.ilike(like), DbColumn.description.ilike(like)))
    ).all()
    for col, tbl in cols:
        results.append(SearchResult(
            type="column",
            id=col.id,
            name=f"{tbl.schema_name}.{tbl.table_name}.{col.column_name}",
            detail=col.description,
        ))

    return results
