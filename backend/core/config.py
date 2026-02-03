"""
JWT and authentication configuration constants.
"""
from settings import settings

# JWT config (defaults for local dev; override via env + settings.py as you like)
JWT_SECRET = getattr(settings, "JWT_SECRET", "dev-secret-change-me")
JWT_ALG = getattr(settings, "JWT_ALG", "HS256")
JWT_EXPIRE_MINUTES = int(getattr(settings, "JWT_EXPIRE_MINUTES", 60 * 24))

# Support different User password hash column names (in case models.py uses a different field).
PASSWORD_HASH_FIELDS = (
    "password_hash",
    "hashed_password",
    "hashed_pw",
    "password_digest",
    "password",  # last resort (some demos name the hashed field 'password')
)

# Support different owner/user id column names on models (Session, ProfileDocument, etc.)
OWNER_ID_FIELDS = (
    "user_id",
    "owner_id",
    "created_by",
)
