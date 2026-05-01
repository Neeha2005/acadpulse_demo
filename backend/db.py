import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

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

def insert_notification(user_id, source_type, external_id, sender, text, category, received_at, course_id=None, source_ref=None):
    """Insert a notification into the database, ignoring duplicates."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO notifications (
                user_id, source_type, external_message_id, sender_name, 
                message_text, category, received_at, course_id, source_reference_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, source_type, external_message_id) DO NOTHING
            RETURNING id;
            """,
            (user_id, source_type, external_id, sender, text, category, received_at, course_id, source_ref)
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

def notification_exists(external_id, source_type):
    """Check if a notification with the given external ID and source type exists."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT 1 FROM notifications WHERE external_message_id = %s AND source_type = %s",
            (external_id, source_type)
        )
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()
