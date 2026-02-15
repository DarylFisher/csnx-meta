from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AppColumnXref, Application, DbColumn, DbTable
from ..schemas import (
    AppBrief,
    DbColumnCreate,
    DbColumnDetail,
    DbColumnOut,
    DbTableCreate,
    DbTableDetail,
    DbTableOut,
)

router = APIRouter(prefix="/api", tags=["tables & columns"])


# --- Tables ---

@router.get("/tables", response_model=list[DbTableOut])
def list_tables(search: str | None = None, db: Session = Depends(get_db)):
    stmt = select(DbTable)
    if search:
        stmt = stmt.where(DbTable.table_name.ilike(f"%{search}%"))
    stmt = stmt.order_by(DbTable.schema_name, DbTable.table_name)
    return db.scalars(stmt).all()


@router.get("/tables/{table_id}", response_model=DbTableDetail)
def get_table(table_id: int, db: Session = Depends(get_db)):
    tbl = db.get(DbTable, table_id)
    if not tbl:
        raise HTTPException(404, "Table not found")
    return tbl


@router.post("/tables", response_model=DbTableOut, status_code=201)
def create_table(body: DbTableCreate, db: Session = Depends(get_db)):
    tbl = DbTable(
        schema_name=body.schema_name,
        table_name=body.table_name,
        description=body.description,
    )
    db.add(tbl)
    db.commit()
    db.refresh(tbl)
    return tbl


@router.post("/tables/{table_id}/columns", response_model=list[DbColumnOut], status_code=201)
def create_columns(table_id: int, body: list[DbColumnCreate], db: Session = Depends(get_db)):
    tbl = db.get(DbTable, table_id)
    if not tbl:
        raise HTTPException(404, "Table not found")
    cols = []
    for c in body:
        col = DbColumn(
            table_id=table_id,
            column_name=c.column_name,
            data_type=c.data_type,
            description=c.description,
        )
        db.add(col)
        cols.append(col)
    db.commit()
    for col in cols:
        db.refresh(col)
    return cols


# --- Columns ---

@router.get("/columns", response_model=list[DbColumnOut])
def list_columns(search: str | None = None, db: Session = Depends(get_db)):
    stmt = select(DbColumn)
    if search:
        stmt = stmt.where(DbColumn.column_name.ilike(f"%{search}%"))
    stmt = stmt.order_by(DbColumn.column_name)
    return db.scalars(stmt).all()


@router.get("/columns/{column_id}", response_model=DbColumnDetail)
def get_column(column_id: int, db: Session = Depends(get_db)):
    col = db.get(DbColumn, column_id)
    if not col:
        raise HTTPException(404, "Column not found")
    tbl = db.get(DbTable, col.table_id)

    stmt = (
        select(AppColumnXref, Application)
        .join(Application, AppColumnXref.application_id == Application.id)
        .where(AppColumnXref.column_id == column_id)
        .order_by(Application.name)
    )
    rows = db.execute(stmt).all()
    apps = [
        AppBrief(id=a.id, name=a.name, usage_type=xref.usage_type)
        for xref, a in rows
    ]
    return DbColumnDetail(
        id=col.id,
        table_id=col.table_id,
        column_name=col.column_name,
        data_type=col.data_type,
        description=col.description,
        table_name=tbl.table_name,
        schema_name=tbl.schema_name,
        apps=apps,
    )
