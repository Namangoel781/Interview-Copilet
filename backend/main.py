"""
AI Copilot Backend - FastAPI Application

This is a modular FastAPI application for interview preparation and learning.
Routes are organized into separate modules under the routers/ directory.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from settings import settings
from db import Base, engine

# Import routers
from routers.auth import router as auth_router, me_router
from routers.profile import router as profile_router
from routers.sessions import router as sessions_router
from routers.questions import router as questions_router
from routers.mcq import router as mcq_router
from routers.dashboard import router as dashboard_router
from routers.interview import router as interview_router
from routers.roadmap import router as roadmap_router
from routers.simulator import router as simulator_router


# --- DB migration helper for User columns ---
def _ensure_users_table_columns() -> None:
    """Best-effort DB migration for local/dev.

    If you changed the `User` model (added columns like domain/role/track/level)
    after the DB table already existed, SQLAlchemy's `create_all()` will NOT
    auto-alter the table. This helper adds missing columns for MySQL.

    Safe to run on every startup.
    """

    try:
        dialect = engine.dialect.name
    except Exception:
        return

    # Only run this auto-migration for MySQL. (SQLite/Postgres users should use Alembic.)
    if dialect not in {"mysql", "mariadb"}:
        return

    def has_column(conn, table: str, col: str) -> bool:
        r = conn.execute(
            text(
                """
                SELECT COUNT(*) AS c
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = :table
                  AND COLUMN_NAME = :col
                """
            ),
            {"table": table, "col": col},
        ).scalar_one()
        return int(r or 0) > 0

    # column_name -> SQL fragment
    desired: dict[str, str] = {
        # auth
        "password_hash": "VARCHAR(255) NULL",
        # profile setup / personalization
        "domain": "VARCHAR(64) NULL",
        "role": "VARCHAR(128) NULL",
        "track": "VARCHAR(32) NULL",
        "level": "VARCHAR(32) NULL",
    }

    try:
        with engine.begin() as conn:
            for col, ddl in desired.items():
                if not has_column(conn, "users", col):
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {ddl}"))
    except Exception:
        # Don't block app startup; users can still run manual migrations.
        return


# Create FastAPI app
app = FastAPI(title=settings.APP_NAME)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
Base.metadata.create_all(bind=engine)
_ensure_users_table_columns()

# Register routers
app.include_router(auth_router)
app.include_router(me_router)
app.include_router(profile_router)
app.include_router(sessions_router)
app.include_router(questions_router)
app.include_router(mcq_router)
app.include_router(dashboard_router)
app.include_router(interview_router)
app.include_router(roadmap_router)
app.include_router(simulator_router)


# Health check endpoint
@app.get("/health")
def health():
    return {"ok": True, "app": settings.APP_NAME}