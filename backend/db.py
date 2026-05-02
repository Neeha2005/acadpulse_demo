import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

def get_db_connection():
    """Establish a connection to the Supabase PostgreSQL database."""
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        port=os.getenv("DB_PORT", "5432"),
        sslmode="require"  # Supabase requires SSL for remote connections
    )
    return conn
def insert_notification(
    user_id,
    source_type,
    external_id,
    sender,
    text,
    category,
    received_at,
    course_id=None,
    source_ref=None,
    deadline=None,
    urgency_level=None,
):
    """Insert a notification into the database, ignoring duplicates."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO notifications (
                user_id, source_type, external_message_id, sender_name, 
                message_text, category, received_at, course_id, source_reference_id, deadline, urgency_level
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, source_type, external_message_id) DO NOTHING
            RETURNING id;
            """,
            (
                user_id,
                source_type,
                external_id,
                sender,
                text,
                category,
                received_at,
                course_id,
                source_ref,
                deadline,
                urgency_level,
            )
        )
        result = cur.fetchone()
        conn.commit()
        return result[0] if result else None
    except Exception as e:
        conn.rollback()
        print(f"Database error: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def update_notification_deadline(notification_id, deadline_datetime):
    """Set the deadline for an existing notification. Returns True if updated."""
    if not notification_id or not deadline_datetime:
        return False

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE notifications
            SET deadline = %s
            WHERE id = %s
            RETURNING id;
            """,
            (deadline_datetime, notification_id),
        )
        updated = cur.fetchone() is not None
        conn.commit()
        return updated
    except Exception as e:
        conn.rollback()
        print(f"Database deadline update error: {e}")
        return False
    finally:
        cur.close()
        conn.close()

def update_notification_category(notification_id, category):
    """Set the category for an existing notification. Returns True if updated."""
    if not notification_id or not category:
        return False

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE notifications
            SET category = %s
            WHERE id = %s
            RETURNING id;
            """,
            (category, notification_id),
        )
        updated = cur.fetchone() is not None
        conn.commit()
        return updated
    except Exception as e:
        conn.rollback()
        print(f"Database category update error: {e}")
        return False
    finally:
        cur.close()
        conn.close()

def get_pending_deadline_notifications(user_id):
    """Fetch pending notifications with deadlines for a user."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT id, deadline, urgency_label
            FROM notifications
            WHERE user_id = %s
              AND is_completed = FALSE
              AND deadline IS NOT NULL
            ORDER BY deadline ASC;
            """,
            (user_id,),
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_users_with_pending_deadlines():
    """Fetch users that currently have pending deadline-bearing notifications."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT DISTINCT user_id
            FROM notifications
            WHERE is_completed = FALSE
              AND deadline IS NOT NULL;
            """
        )
        return [row[0] for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()

def update_notification_urgency(notification_id, score, label):
    """Update urgency metadata. Returns True if the notification existed."""
    if not notification_id:
        return False

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE notifications
            SET urgency_score = %s,
                urgency_label = %s,
                urgency_level = NULLIF(%s, 'none')
            WHERE id = %s
            RETURNING id;
            """,
            (score, label, label, notification_id),
        )
        updated = cur.fetchone() is not None
        conn.commit()
        return updated
    except Exception as e:
        conn.rollback()
        print(f"Database urgency update error: {e}")
        return False
    finally:
        cur.close()
        conn.close()

def update_notification_completion(notification_id, completed=True):
    """Update completion status. Returns the updated row or None if not found."""
    if not notification_id:
        return None

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            UPDATE notifications
            SET is_completed = %s
            WHERE id = %s
            RETURNING
                id,
                user_id,
                source_type,
                sender_name,
                message_text,
                category,
                deadline,
                urgency_score,
                urgency_label,
                is_completed,
                received_at,
                created_at;
            """,
            (completed, notification_id),
        )
        row = cur.fetchone()
        conn.commit()
        return row
    except Exception as e:
        conn.rollback()
        print(f"Database completion update error: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def get_notification_by_id(notification_id):
    """Fetch one notification row by ID."""
    if not notification_id:
        return None

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT
                id,
                user_id,
                course_id,
                source_type,
                source_reference_id,
                external_message_id,
                sender_name,
                message_text,
                category,
                deadline,
                urgency_score,
                urgency_label,
                urgency_level,
                is_completed,
                received_at,
                created_at
            FROM notifications
            WHERE id = %s
            LIMIT 1;
            """,
            (notification_id,),
        )
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

def list_notifications(user_id=None, include_completed=False, source_type=None, limit=100):
    """Fetch notifications with optional filters for dashboard sync."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        clauses = []
        params = []

        if user_id:
            clauses.append("user_id = %s")
            params.append(user_id)

        if not include_completed:
            clauses.append("is_completed = FALSE")

        if source_type:
            clauses.append("LOWER(source_type) = LOWER(%s)")
            params.append(source_type)

        where_sql = ""
        if clauses:
            where_sql = "WHERE " + " AND ".join(clauses)

        params.append(limit)

        cur.execute(
            f"""
            SELECT
                id,
                user_id,
                course_id,
                source_type,
                source_reference_id,
                external_message_id,
                sender_name,
                message_text,
                category,
                deadline,
                urgency_score,
                urgency_label,
                urgency_level,
                is_completed,
                received_at,
                created_at
            FROM notifications
            {where_sql}
            ORDER BY
                CASE WHEN deadline IS NULL THEN 1 ELSE 0 END,
                deadline ASC NULLS LAST,
                received_at DESC NULLS LAST,
                created_at DESC
            LIMIT %s;
            """,
            params,
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_or_create_user(full_name, email):
    """Get user ID by email or create a new user."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        if user:
            return user[0]
        
        cur.execute(
            "INSERT INTO users (full_name, email) VALUES (%s, %s) RETURNING id",
            (full_name, email)
        )
        new_user = cur.fetchone()
        conn.commit()
        return new_user[0]
    finally:
        cur.close()
        conn.close()

def get_user_by_email(email):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT id, full_name, email, password_hash
            FROM users
            WHERE email = %s
            LIMIT 1
            """,
            (email,),
        )
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

def get_user_by_id(user_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT id, full_name, email, password_hash
            FROM users
            WHERE id = %s
            LIMIT 1
            """,
            (user_id,),
        )
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

def create_user_account(full_name, email, password_hash):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO users (full_name, email, password_hash)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (full_name, email, password_hash),
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        return user_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def notification_exists(external_id, source_type, user_id=None):
    """Check if a notification with the given source identity exists.

    When user_id is provided, the lookup is scoped to that user. Otherwise,
    it falls back to the legacy global source lookup by external ID and source type.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if user_id is None:
            cur.execute(
                "SELECT 1 FROM notifications WHERE external_message_id = %s AND source_type = %s",
                (external_id, source_type),
            )
        else:
            cur.execute(
                "SELECT 1 FROM notifications WHERE user_id = %s AND external_message_id = %s AND source_type = %s",
                (user_id, external_id, source_type),
            )
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()

def get_notification_id_by_source(external_id, source_type):
    """Return the first notification ID for a source message, if present."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id
            FROM notifications
            WHERE external_message_id = %s
              AND source_type = %s
            ORDER BY created_at DESC
            LIMIT 1;
            """,
            (external_id, source_type),
        )
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        cur.close()
        conn.close()
