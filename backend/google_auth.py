from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

# Google OAuth files live in the backend folder.
BASE_DIR = Path(__file__).resolve().parent
CREDENTIALS_FILE = BASE_DIR / "credentials.json"
TOKEN_FILE = BASE_DIR / "token.json"
OAUTH_LOCAL_PORT = 8080

# These permissions allow read-only access to Gmail and selected Classroom data.
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.announcements.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
]


def get_google_credentials():
    """Load, refresh, or create Google OAuth credentials for AcadPulse."""
    credentials = None

    # Reuse the saved login token when it already exists.
    if TOKEN_FILE.exists():
        try:
            credentials = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        except ValueError:
            # If scopes have changed, delete the old token and force re-auth
            TOKEN_FILE.unlink()
            credentials = None

    # If the saved token is valid, return it immediately.
    if credentials and credentials.valid:
        return credentials

    # If the token expired but has a refresh token, refresh it silently.
    if credentials and credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
    else:
        # If there is no usable token, open the browser for Google login.
        # A fixed local port keeps the redirect URL stable for Google Cloud.
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        credentials = flow.run_local_server(port=OAUTH_LOCAL_PORT)

    # Save the new or refreshed token for future runs.
    TOKEN_FILE.write_text(credentials.to_json(), encoding="utf-8")

    return credentials
