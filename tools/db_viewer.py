import html
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")

app = FastAPI(title="AcadPulse DB Viewer")


def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


def render_page(title, body):
    return HTMLResponse(
        f"""
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>{html.escape(title)}</title>
          <style>
            body {{ font-family: Segoe UI, Arial, sans-serif; margin: 24px; background: #0f172a; color: #e5e7eb; }}
            a {{ color: #38bdf8; text-decoration: none; }}
            a:hover {{ text-decoration: underline; }}
            table {{ border-collapse: collapse; width: 100%; margin-top: 16px; background: #111827; }}
            th, td {{ border: 1px solid #334155; padding: 8px 10px; text-align: left; vertical-align: top; max-width: 420px; }}
            th {{ background: #1f2937; position: sticky; top: 0; }}
            td {{ overflow-wrap: anywhere; }}
            .nav {{ margin-bottom: 18px; }}
            .pill {{ display: inline-block; padding: 6px 10px; margin: 4px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; }}
            .muted {{ color: #94a3b8; }}
          </style>
        </head>
        <body>
          <div class="nav"><a href="/">Tables</a></div>
          {body}
        </body>
        </html>
        """
    )


@app.get("/", response_class=HTMLResponse)
def list_tables():
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
                """
            )
            tables = [row["table_name"] for row in cur.fetchall()]

    body = "<h1>AcadPulse Database</h1><p class='muted'>Public schema tables</p>"
    body += "".join(
        f"<a class='pill' href='/table/{html.escape(table)}'>{html.escape(table)}</a>"
        for table in tables
    )
    return render_page("AcadPulse DB", body)


@app.get("/table/{table_name}", response_class=HTMLResponse)
def show_table(table_name: str, limit: int = Query(default=50, ge=1, le=500)):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = %s
                """,
                (table_name,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Table not found")

            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
                """,
                (table_name,),
            )
            columns = [row["column_name"] for row in cur.fetchall()]

            quoted_table = '"' + table_name.replace('"', '""') + '"'
            order_sql = " ORDER BY created_at DESC" if "created_at" in columns else ""
            cur.execute(f"SELECT * FROM {quoted_table}{order_sql} LIMIT %s", (limit,))
            rows = cur.fetchall()

    header = "".join(f"<th>{html.escape(column)}</th>" for column in columns)
    body_rows = []
    for row in rows:
        body_rows.append(
            "<tr>"
            + "".join(
                f"<td>{html.escape(str(row.get(column, '')))}</td>"
                for column in columns
            )
            + "</tr>"
        )

    body = f"<h1>{html.escape(table_name)}</h1><p class='muted'>Showing up to {limit} rows</p>"
    body += f"<table><thead><tr>{header}</tr></thead><tbody>{''.join(body_rows)}</tbody></table>"
    return render_page(f"Table: {table_name}", body)


if __name__ == "__main__":
    import uvicorn

    sys.path.insert(0, str(ROOT / "backend"))
    uvicorn.run(app, host="127.0.0.1", port=8090)
