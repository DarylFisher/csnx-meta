#!/usr/bin/env python3
"""Extract table/column metadata from DB2 system catalog and load into CSNX Meta."""

import argparse
import sys

import ibm_db
import requests


def format_data_type(typename: str, length: int, scale: int) -> str:
    """Format DB2 type info into a readable data type string."""
    t = typename.strip()
    if t in ("VARCHAR", "CHAR", "CHARACTER", "GRAPHIC", "VARGRAPHIC", "CLOB", "BLOB"):
        return f"{t}({length})"
    if t in ("DECIMAL", "NUMERIC") and scale > 0:
        return f"{t}({length},{scale})"
    if t in ("DECIMAL", "NUMERIC"):
        return f"{t}({length})"
    return t


def fetch_tables(conn, schema: str, table_pattern: str) -> list[dict]:
    sql = (
        "SELECT TABNAME, REMARKS "
        "FROM SYSCAT.TABLES "
        "WHERE TABSCHEMA = ? AND TABNAME LIKE ? AND TYPE = 'T' "
        "ORDER BY TABNAME"
    )
    stmt = ibm_db.prepare(conn, sql)
    ibm_db.bind_param(stmt, 1, schema)
    ibm_db.bind_param(stmt, 2, table_pattern)
    ibm_db.execute(stmt)

    tables = []
    row = ibm_db.fetch_assoc(stmt)
    while row:
        tables.append({
            "table_name": row["TABNAME"].strip(),
            "description": (row["REMARKS"] or "").strip() or None,
        })
        row = ibm_db.fetch_assoc(stmt)
    return tables


def fetch_columns(conn, schema: str, table_name: str) -> list[dict]:
    sql = (
        "SELECT COLNAME, TYPENAME, LENGTH, SCALE, REMARKS "
        "FROM SYSCAT.COLUMNS "
        "WHERE TABSCHEMA = ? AND TABNAME = ? "
        "ORDER BY COLNO"
    )
    stmt = ibm_db.prepare(conn, sql)
    ibm_db.bind_param(stmt, 1, schema)
    ibm_db.bind_param(stmt, 2, table_name)
    ibm_db.execute(stmt)

    columns = []
    row = ibm_db.fetch_assoc(stmt)
    while row:
        columns.append({
            "column_name": row["COLNAME"].strip(),
            "data_type": format_data_type(row["TYPENAME"], row["LENGTH"], row["SCALE"]),
            "description": (row["REMARKS"] or "").strip() or None,
        })
        row = ibm_db.fetch_assoc(stmt)
    return columns


def post_table(api_url: str, schema: str, table: dict) -> int:
    resp = requests.post(
        f"{api_url}/api/tables",
        json={
            "schema_name": schema,
            "table_name": table["table_name"],
            "description": table["description"],
        },
    )
    resp.raise_for_status()
    return resp.json()["id"]


def post_columns(api_url: str, table_id: int, columns: list[dict]) -> int:
    if not columns:
        return 0
    resp = requests.post(f"{api_url}/api/tables/{table_id}/columns", json=columns)
    resp.raise_for_status()
    return len(resp.json())


def main():
    parser = argparse.ArgumentParser(
        description="Import DB2 catalog metadata into CSNX Meta"
    )
    parser.add_argument(
        "--db2-dsn",
        required=True,
        help="DB2 connection string for ibm_db.connect()",
    )
    parser.add_argument("--schema", required=True, help="DB2 schema name")
    parser.add_argument(
        "--table-pattern", default="%", help="SQL LIKE pattern for table names (default: %%)"
    )
    parser.add_argument(
        "--api-url", default="http://localhost:8000", help="CSNX Meta backend URL"
    )
    args = parser.parse_args()

    # Connect to DB2
    print(f"Connecting to DB2...")
    try:
        conn = ibm_db.connect(args.db2_dsn, "", "")
    except Exception as exc:
        print(f"ERROR: Failed to connect to DB2: {exc}", file=sys.stderr)
        sys.exit(1)
    print("Connected.")

    # Fetch matching tables
    schema = args.schema.upper()
    tables = fetch_tables(conn, schema, args.table_pattern)
    print(f"Found {len(tables)} table(s) matching {schema}.{args.table_pattern}")

    if not tables:
        ibm_db.close(conn)
        return

    total_cols = 0
    for tbl in tables:
        # Create table in API
        table_id = post_table(args.api_url, schema, tbl)
        print(f"  Created table {schema}.{tbl['table_name']} (id={table_id})")

        # Fetch and post columns
        columns = fetch_columns(conn, schema, tbl["table_name"])
        count = post_columns(args.api_url, table_id, columns)
        total_cols += count
        print(f"    -> {count} column(s)")

    ibm_db.close(conn)
    print(f"\nDone: {len(tables)} table(s), {total_cols} column(s) imported.")


if __name__ == "__main__":
    main()
