import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_engine = None


def _build_engine():
    instance_name = os.getenv("INSTANCE_CONNECTION_NAME")

    if instance_name:
        from google.cloud.sql.connector import Connector

        connector = Connector()

        def getconn():
            return connector.connect(
                instance_name,
                "pg8000",
                user=os.environ["DB_USER"],
                password=os.environ["DB_PASS"],
                db=os.environ["DB_NAME"],
            )

        return create_engine(
            "postgresql+pg8000://",
            creator=getconn,
            pool_pre_ping=True,
        )

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "Set INSTANCE_CONNECTION_NAME (Cloud SQL) or DATABASE_URL (local)"
        )
    return create_engine(database_url, pool_pre_ping=True)


def get_engine():
    global _engine
    if _engine is None:
        _engine = _build_engine()
    return _engine


SessionLocal = None


def get_db():
    global SessionLocal
    if SessionLocal is None:
        SessionLocal = sessionmaker(bind=get_engine())
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
