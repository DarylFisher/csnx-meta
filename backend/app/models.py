import enum

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class UsageType(str, enum.Enum):
    READ = "READ"
    WRITE = "WRITE"
    READ_WRITE = "READ_WRITE"


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    xrefs: Mapped[list["AppColumnXref"]] = relationship(back_populates="application", cascade="all, delete-orphan")


class DbTable(Base):
    __tablename__ = "db_tables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    schema_name: Mapped[str] = mapped_column(String(255), nullable=False, default="public")
    table_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    columns: Mapped[list["DbColumn"]] = relationship(back_populates="table", cascade="all, delete-orphan")


class DbColumn(Base):
    __tablename__ = "db_columns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("db_tables.id"), nullable=False)
    column_name: Mapped[str] = mapped_column(String(255), nullable=False)
    data_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    table: Mapped["DbTable"] = relationship(back_populates="columns")
    xrefs: Mapped[list["AppColumnXref"]] = relationship(back_populates="column", cascade="all, delete-orphan")


class AppColumnXref(Base):
    __tablename__ = "app_column_xref"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), nullable=False)
    column_id: Mapped[int] = mapped_column(ForeignKey("db_columns.id"), nullable=False)
    usage_type: Mapped[UsageType] = mapped_column(Enum(UsageType), nullable=False)

    application: Mapped["Application"] = relationship(back_populates="xrefs")
    column: Mapped["DbColumn"] = relationship(back_populates="xrefs")
