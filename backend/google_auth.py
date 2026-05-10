import json
import os
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

BASE_DIR = Path(__file__).resolve().parent
CREDENTIALS_FILE = BASE_DIR / "credentials.json"
GOOGLE_TOKENS_DIR = BASE_DIR / "google_tokens"
SUPPORTED_INTEGRATIONS = {"gmail", "classroom"}

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.announcements.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
    "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
]


def get_client_config() -> dict:
    """Return OAuth client config from credentials.json or env vars."""
    if CREDENTIALS_FILE.exists():
        with open(CREDENTIALS_FILE) as f:
            return json.load(f)

    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        raise ValueError(
            "Google credentials not configured. "
            "Place credentials.json in the backend folder, or set "
            "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env"
        )

    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [],
        }
    }


def is_google_configured() -> bool:
    try:
        get_client_config()
        return True
    except (ValueError, FileNotFoundError):
        return False


def create_oauth_flow(redirect_uri: str) -> Flow:
    """Create a web-based OAuth 2.0 flow."""
    config = get_client_config()
    flow = Flow.from_client_config(config, scopes=SCOPES, redirect_uri=redirect_uri)
    return flow


def _normalize_integration(integration: Optional[str]) -> Optional[str]:
    value = (integration or "").strip().lower()
    return value if value in SUPPORTED_INTEGRATIONS else None


def _token_path(user_id: str, integration: Optional[str] = None) -> Path:
    GOOGLE_TOKENS_DIR.mkdir(exist_ok=True)
    safe_id = str(user_id).replace("/", "_").replace("..", "_").replace(":", "_")
    scope = _normalize_integration(integration)
    suffix = f"__{scope}" if scope else ""
    return GOOGLE_TOKENS_DIR / f"{safe_id}{suffix}.json"


def save_google_credentials(user_id: str, credentials: Credentials, integration: Optional[str] = None) -> None:
    token_data = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri or "https://oauth2.googleapis.com/token",
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes or SCOPES),
    }
    _token_path(user_id, integration=integration).write_text(json.dumps(token_data), encoding="utf-8")


def load_google_credentials(user_id: str, integration: Optional[str] = None) -> Optional[Credentials]:
    """Load stored Google credentials for a user, refreshing if expired."""
    path = _token_path(user_id, integration=integration)
    if not path.exists():
        return None
    try:
        token_data = json.loads(path.read_text())
        creds = Credentials(
            token=token_data.get("token"),
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=token_data.get("client_id"),
            client_secret=token_data.get("client_secret"),
            scopes=token_data.get("scopes", SCOPES),
        )
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            save_google_credentials(user_id, creds, integration=integration)
        return creds
    except Exception:
        return None


def google_connected_for_user(user_id: str, integration: Optional[str] = None) -> bool:
    normalized = _normalize_integration(integration)
    if normalized:
        return _token_path(user_id, integration=normalized).exists()
    return any(_token_path(user_id, integration=item).exists() for item in SUPPORTED_INTEGRATIONS) or _token_path(user_id).exists()


def delete_google_credentials(user_id: str, integration: Optional[str] = None) -> None:
    """Remove stored Google credentials for a user."""
    normalized = _normalize_integration(integration)
    if normalized:
        path = _token_path(user_id, integration=normalized)
        if path.exists():
            path.unlink()
        return

    for path in [_token_path(user_id), *[_token_path(user_id, integration=item) for item in SUPPORTED_INTEGRATIONS]]:
        if path.exists():
            path.unlink()


def get_google_credentials(user_id: Optional[str] = None, integration: Optional[str] = None) -> Credentials:
    """
    Load Google credentials for a user.
    Falls back to legacy token.json for single-user backwards compat.
    """
    if user_id:
        normalized = _normalize_integration(integration)
        creds = load_google_credentials(user_id, integration=normalized) if normalized else None
        if creds:
            return creds

        creds = load_google_credentials(user_id)
        if creds:
            return creds

    legacy = BASE_DIR / "token.json"
    if legacy.exists():
        try:
            token_data = json.loads(legacy.read_text())
            config = get_client_config()
            client_info = config.get("web") or config.get("installed", {})
            creds = Credentials(
                token=token_data.get("token"),
                refresh_token=token_data.get("refresh_token"),
                token_uri="https://oauth2.googleapis.com/token",
                client_id=token_data.get("client_id") or client_info.get("client_id"),
                client_secret=token_data.get("client_secret") or client_info.get("client_secret"),
                scopes=token_data.get("scopes", SCOPES),
            )
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
            return creds
        except Exception:
            pass

    raise FileNotFoundError(
        "No Google credentials found for this user. "
        "Connect Google via the onboarding page."
    )
