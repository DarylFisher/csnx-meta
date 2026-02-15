from pydantic import BaseModel

from .models import UsageType


# --- Application ---

class ApplicationCreate(BaseModel):
    name: str
    description: str | None = None


class ApplicationOut(BaseModel):
    id: int
    name: str
    description: str | None

    model_config = {"from_attributes": True}


class ColumnBrief(BaseModel):
    id: int
    column_name: str
    data_type: str
    table_name: str
    schema_name: str
    usage_type: UsageType


class ApplicationDetail(ApplicationOut):
    columns: list[ColumnBrief] = []


# --- Table ---

class DbTableOut(BaseModel):
    id: int
    schema_name: str
    table_name: str
    description: str | None

    model_config = {"from_attributes": True}


class DbColumnOut(BaseModel):
    id: int
    table_id: int
    column_name: str
    data_type: str
    description: str | None

    model_config = {"from_attributes": True}


class DbTableDetail(DbTableOut):
    columns: list[DbColumnOut] = []


# --- Column detail ---

class AppBrief(BaseModel):
    id: int
    name: str
    usage_type: UsageType


class DbColumnDetail(DbColumnOut):
    table_name: str
    schema_name: str
    apps: list[AppBrief] = []


# --- Xref ---

class XrefCreate(BaseModel):
    application_id: int
    column_id: int
    usage_type: UsageType


class XrefOut(BaseModel):
    id: int
    application_id: int
    column_id: int
    usage_type: UsageType

    model_config = {"from_attributes": True}


class XrefDetail(XrefOut):
    application_name: str
    column_name: str
    table_name: str
    schema_name: str


# --- Search ---

class SearchResult(BaseModel):
    type: str  # "application", "table", "column"
    id: int
    name: str
    detail: str | None = None
