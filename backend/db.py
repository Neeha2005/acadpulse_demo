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
    expanded_text=None,
):
    """Insert a notification into the database, ignoring duplicates."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO notifications (
                user_id, source_type, external_message_id, sender_name, 
                message_text, category, received_at, course_id, source_reference_id, 
                deadline, urgency_level, expanded_text
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                expanded_text or text,
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

def update_notification_fields(
    notification_id,
    message_text=None,
    category=None,
    deadline_marker=False,
    deadline=None,
):
    """Update editable notification fields. Use deadline_marker=True to clear/set deadline."""
    if not notification_id:
        return None

    updates = []
    params = []

    if message_text is not None:
        updates.append("message_text = %s")
        params.append(message_text)
    if category is not None:
        updates.append("category = %s")
        params.append(category)
    if deadline_marker:
        updates.append("deadline = %s")
        params.append(deadline)

    if not updates:
        return get_notification_by_id(notification_id)

    params.append(notification_id)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            f"""
            UPDATE notifications
            SET {", ".join(updates)}
            WHERE id = %s
            RETURNING
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
                created_at;
            """,
            params,
        )
        row = cur.fetchone()
        conn.commit()
        return row
    except Exception as e:
        conn.rollback()
        print(f"Database notification field update error: {e}")
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
            SELECT * FROM notifications WHERE id = %s LIMIT 1;
            """,
            (notification_id,),
        )
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

def delete_notification(notification_id, user_id):
    """Delete a notification from the database."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM notifications WHERE id = %s AND user_id = %s RETURNING id",
            (notification_id, user_id),
        )
        row = cur.fetchone()
        conn.commit()
        return row is not None
    except Exception as e:
        conn.rollback()
        print(f"Database error deleting notification: {e}")
        return False
    finally:
        cur.close()
        conn.close()

def get_course_by_name(course_name, user_id):
    """Fetch a course by name or code for a user."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT c.id, c.course_name, c.course_code, c.short_name
            FROM courses c
            JOIN user_courses uc ON uc.course_id = c.id
            WHERE uc.user_id = %s 
              AND (
                  LOWER(c.course_name) = LOWER(%s)
                  OR LOWER(c.course_code) = LOWER(%s)
                  OR LOWER(COALESCE(c.short_name, '')) = LOWER(%s)
              )
            LIMIT 1
            """,
            (user_id, course_name, course_name, course_name),
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
            clauses.append("n.user_id = %s")
            params.append(user_id)

        if not include_completed:
            clauses.append("n.is_completed = FALSE")

        if source_type:
            clauses.append("LOWER(n.source_type) = LOWER(%s)")
            params.append(source_type)

        where_sql = ""
        if clauses:
            where_sql = "WHERE " + " AND ".join(clauses)

        params.append(limit)

        cur.execute(
            f"""
            SELECT
                n.id,
                n.user_id,
                n.course_id,
                c.course_name,
                c.course_code,
                c.short_name,
                n.source_type,
                n.source_reference_id,
                n.external_message_id,
                n.sender_name,
                n.message_text,
                n.category,
                n.deadline,
                n.urgency_score,
                n.urgency_label,
                n.urgency_level,
                n.is_completed,
                n.received_at,
                n.created_at
            FROM notifications n
            LEFT JOIN courses c ON c.id = n.course_id
            {where_sql}
            ORDER BY
                CASE WHEN n.deadline IS NULL THEN 1 ELSE 0 END,
                n.deadline ASC NULLS LAST,
                n.received_at DESC NULLS LAST,
                n.created_at DESC
            LIMIT %s;
            """,
            params,
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def list_courses(user_id=None):
    """Fetch courses available to a user, including aliases where present."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        params = []
        user_filter = ""
        if user_id:
            user_filter = "WHERE uc.user_id = %s OR uc.user_id IS NULL"
            params.append(user_id)

        cur.execute(
            f"""
            SELECT
                c.id,
                c.course_code,
                c.short_name,
                c.course_name,
                COALESCE(
                    ARRAY_AGG(DISTINCT ca.alias)
                    FILTER (WHERE ca.alias IS NOT NULL),
                    ARRAY[]::TEXT[]
                ) AS aliases
            FROM courses c
            LEFT JOIN course_aliases ca ON ca.course_id = c.id
            LEFT JOIN user_courses uc ON uc.course_id = c.id
            {user_filter}
            GROUP BY c.id, c.course_code, c.short_name, c.course_name
            ORDER BY c.course_code, c.course_name;
            """,
            params,
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_course_by_id(course_id, user_id=None):
    """Fetch one course with aliases."""
    if not course_id:
        return None

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        params = [course_id]
        user_filter = ""
        if user_id:
            user_filter = "AND (uc.user_id = %s OR uc.user_id IS NULL)"
            params.append(user_id)

        cur.execute(
            f"""
            SELECT
                c.id,
                c.course_code,
                c.short_name,
                c.course_name,
                COALESCE(
                    ARRAY_AGG(DISTINCT ca.alias)
                    FILTER (WHERE ca.alias IS NOT NULL),
                    ARRAY[]::TEXT[]
                ) AS aliases
            FROM courses c
            LEFT JOIN course_aliases ca ON ca.course_id = c.id
            LEFT JOIN user_courses uc ON uc.course_id = c.id
            WHERE c.id = %s
              {user_filter}
            GROUP BY c.id, c.course_code, c.short_name, c.course_name
            LIMIT 1;
            """,
            params,
        )
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

def normalize_aliases(aliases):
    """Return trimmed, de-duplicated aliases while preserving user-facing casing."""
    seen = set()
    normalized = []
    for alias in aliases or []:
        value = str(alias or "").strip()
        key = value.lower()
        if not value or key in seen:
            continue
        seen.add(key)
        normalized.append(value)
    return normalized

def replace_course_aliases(course_id, aliases):
    """Replace all aliases for a course and return the normalized aliases."""
    cleaned_aliases = normalize_aliases(aliases)

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM course_aliases WHERE course_id = %s;", (course_id,))
        for alias in cleaned_aliases:
            cur.execute(
                """
                INSERT INTO course_aliases (course_id, alias)
                VALUES (%s, %s)
                ON CONFLICT (course_id, alias) DO NOTHING;
                """,
                (course_id, alias),
            )
        conn.commit()
        return cleaned_aliases
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def upsert_course(course_code, course_name, aliases=None, user_id=None, short_name=None):
    """Create or update a course by course code, then replace aliases."""
    code = (course_code or "").strip()
    name = (course_name or "").strip()
    short = (short_name or "").strip() or None
    if not code or not name:
        return None

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id
            FROM courses
            WHERE LOWER(course_code) = LOWER(%s)
            LIMIT 1;
            """,
            (code,),
        )
        existing = cur.fetchone()

        if existing:
            course_id = existing[0]
            cur.execute(
                """
                UPDATE courses
                SET course_code = %s,
                    course_name = %s,
                    short_name = %s
                WHERE id = %s;
                """,
                (code, name, short, course_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO courses (course_code, course_name, short_name)
                VALUES (%s, %s, %s)
                RETURNING id;
                """,
                (code, name, short),
            )
            course_id = cur.fetchone()[0]

        if user_id:
            cur.execute(
                """
                INSERT INTO user_courses (user_id, course_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING;
                """,
                (user_id, course_id),
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

    replace_course_aliases(course_id, aliases or [])
    return course_id

def record_whatsapp_group(group_id, group_name=None, user_id=None, is_general=False):
    """Store a WhatsApp group seen by the bridge and optionally attach it to a user."""
    if not group_id:
        return None

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO whatsapp_groups (whatsapp_group_id, group_name, is_general)
            VALUES (%s, %s, %s)
            ON CONFLICT (whatsapp_group_id) DO UPDATE
            SET group_name = COALESCE(NULLIF(EXCLUDED.group_name, ''), whatsapp_groups.group_name),
                is_general = whatsapp_groups.is_general OR EXCLUDED.is_general
            RETURNING id;
            """,
            (group_id, group_name or group_id, is_general),
        )
        whatsapp_group_pk = cur.fetchone()[0]

        if user_id:
            cur.execute(
                """
                INSERT INTO user_whatsapp_groups (user_id, whatsapp_group_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING;
                """,
                (user_id, whatsapp_group_pk),
            )

        conn.commit()
        return whatsapp_group_pk
    except Exception as e:
        conn.rollback()
        print(f"Database WhatsApp group record error: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def list_whatsapp_groups(user_id=None):
    """Return WhatsApp groups from saved groups and previously stored notifications."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        params = []
        group_user_filter = ""
        notification_user_filter = ""
        if user_id:
            group_user_filter = "WHERE uwg.user_id = %s OR uwg.user_id IS NULL"
            notification_user_filter = "AND n.user_id = %s"
            params.extend([user_id, user_id])

        cur.execute(
            f"""
            WITH saved_groups AS (
                SELECT
                    wg.whatsapp_group_id AS group_id,
                    wg.group_name,
                    wg.is_general,
                    'saved' AS source
                FROM whatsapp_groups wg
                LEFT JOIN user_whatsapp_groups uwg ON uwg.whatsapp_group_id = wg.id
                {group_user_filter}
            ),
            notification_groups AS (
                SELECT DISTINCT
                    n.source_reference_id AS group_id,
                    COALESCE(n.source_reference_id, 'WhatsApp group') AS group_name,
                    FALSE AS is_general,
                    'notifications' AS source
                FROM notifications n
                WHERE n.source_type = 'whatsapp'
                  AND n.source_reference_id IS NOT NULL
                  {notification_user_filter}
            )
            SELECT DISTINCT ON (group_id)
                group_id,
                group_name,
                is_general,
                source
            FROM (
                SELECT * FROM saved_groups
                UNION ALL
                SELECT * FROM notification_groups
            ) groups
            WHERE group_id IS NOT NULL AND group_id <> ''
            ORDER BY group_id, source;
            """,
            params,
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def record_classroom_course(classroom_id, classroom_name=None, user_id=None):
    """Store a Google Classroom course seen during sync and optionally attach it to a user."""
    if not classroom_id:
        return None

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO classroom_courses (classroom_id, classroom_name)
            VALUES (%s, %s)
            ON CONFLICT (classroom_id) DO UPDATE
            SET classroom_name = COALESCE(NULLIF(EXCLUDED.classroom_name, ''), classroom_courses.classroom_name)
            RETURNING id;
            """,
            (classroom_id, classroom_name or classroom_id),
        )
        classroom_course_pk = cur.fetchone()[0]

        if user_id:
            cur.execute(
                """
                INSERT INTO user_classroom_courses (user_id, classroom_course_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING;
                """,
                (user_id, classroom_course_pk),
            )

        conn.commit()
        return classroom_course_pk
    except Exception as e:
        conn.rollback()
        print(f"Database Classroom course record error: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def list_classroom_courses(user_id=None):
    """Return Classroom courses discovered from Google Classroom sync."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        params = []
        user_filter = ""
        if user_id:
            user_filter = "WHERE ucc.user_id = %s OR ucc.user_id IS NULL"
            params.append(user_id)

        cur.execute(
            f"""
            SELECT DISTINCT ON (cc.classroom_id)
                cc.classroom_id,
                cc.classroom_name
            FROM classroom_courses cc
            LEFT JOIN user_classroom_courses ucc ON ucc.classroom_course_id = cc.id
            {user_filter}
            ORDER BY cc.classroom_id, cc.classroom_name;
            """,
            params,
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_course_mapping_course_id(user_id, source_type, source_reference_id):
    """Return mapped local course_id for a source reference, if configured."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT course_id
            FROM course_source_mappings
            WHERE user_id = %s
              AND source_type = %s
              AND source_reference_id = %s
            ORDER BY id DESC
            LIMIT 1;
            """,
            (user_id, source_type, source_reference_id),
        )
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        cur.close()
        conn.close()

def list_course_source_mappings(user_id=None, source_type="whatsapp"):
    """List saved source-to-course mappings for the mapping UI."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        params = [source_type]
        user_clause = ""
        if user_id:
            user_clause = "AND csm.user_id = %s"
            params.append(user_id)

        cur.execute(
            f"""
            SELECT
                csm.id,
                csm.user_id,
                csm.course_id,
                c.course_code,
                c.short_name,
                c.course_name,
                csm.source_type,
                csm.source_reference_id,
                COALESCE(wg.group_name, cc.classroom_name) AS source_name
            FROM course_source_mappings csm
            JOIN courses c ON c.id = csm.course_id
            LEFT JOIN whatsapp_groups wg
                ON wg.whatsapp_group_id = csm.source_reference_id
               AND csm.source_type = 'whatsapp'
            LEFT JOIN classroom_courses cc
                ON cc.classroom_id = csm.source_reference_id
               AND csm.source_type = 'classroom'
            WHERE csm.source_type = %s
              {user_clause}
            ORDER BY c.course_code, csm.source_reference_id;
            """,
            params,
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def upsert_course_source_mapping(user_id, course_id, source_type, source_reference_id):
    """Save one course mapping for a source reference, replacing the old one."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            DELETE FROM course_source_mappings
            WHERE user_id = %s
              AND source_type = %s
              AND source_reference_id = %s;
            """,
            (user_id, source_type, source_reference_id),
        )
        cur.execute(
            """
            INSERT INTO course_source_mappings (
                user_id,
                course_id,
                source_type,
                source_reference_id
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id, user_id, course_id, source_type, source_reference_id;
            """,
            (user_id, course_id, source_type, source_reference_id),
        )
        row = cur.fetchone()
        conn.commit()
        return row
    except Exception:
        conn.rollback()
        raise
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
        
        # Seed default abbreviations for new user
        try:
            from notification_abbr import seed_default_abbreviations
            seed_default_abbreviations(new_user[0])
        except Exception as e:
            print(f"Error seeding abbreviations: {e}")
            
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
            SELECT id, full_name, email, whatsapp_number, password_hash, university, degree, semester
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

def get_user_by_login(identifier):
    normalized_email = (identifier or "").strip().lower()
    normalized_phone = "".join(ch for ch in str(identifier or "") if ch.isdigit())
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT id, full_name, email, whatsapp_number, password_hash, university, degree, semester
            FROM users
            WHERE LOWER(email) = %s
               OR regexp_replace(COALESCE(whatsapp_number, ''), '\\D', '', 'g') = %s
            LIMIT 1
            """,
            (normalized_email, normalized_phone),
        )
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

def update_existing_user_account(user_id, full_name=None, email=None, password_hash=None, phone=None, university=None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE users
            SET full_name = COALESCE(NULLIF(%s, ''), full_name),
                email = COALESCE(NULLIF(%s, ''), email),
                whatsapp_number = COALESCE(NULLIF(%s, ''), whatsapp_number),
                university = COALESCE(NULLIF(%s, ''), university),
                password_hash = COALESCE(%s, password_hash)
            WHERE id = %s
            """,
            (full_name or "", email or "", phone or "", university or "", password_hash, user_id),
        )
        conn.commit()
        return user_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def get_user_by_id(user_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT id, full_name as name, email, university, degree, semester
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

def get_chatbot_context_data(user_id):
    """
    Fetch all data needed for the chatbot context in a few efficient queries.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # 1. Get student profile
        cur.execute(
            "SELECT full_name as name, university, degree, semester FROM users WHERE id = %s",
            (user_id,)
        )
        student = cur.fetchone() or {"name": "Scholar", "university": "FAST", "degree": "BS Computer Science", "semester": "5th"}

        # 2. Get course names
        cur.execute(
            """
            SELECT c.course_name, c.course_code, c.short_name
            FROM courses c
            JOIN user_courses uc ON uc.course_id = c.id
            WHERE uc.user_id = %s
            """,
            (user_id,)
        )
        courses = [
            f"{row['course_code']} {row.get('short_name') or ''} {row['course_name']}".strip()
            for row in cur.fetchall()
        ]

        # 3. Get notification summary stats
        cur.execute(
            """
            SELECT 
                COUNT(*) FILTER (WHERE is_completed = false) as total_pending,
                COUNT(*) FILTER (WHERE is_completed = false AND urgency_label = 'critical') as critical_count,
                COUNT(*) FILTER (WHERE is_completed = false AND urgency_label = 'high') as high_count,
                COUNT(*) FILTER (WHERE is_completed = false AND urgency_label = 'overdue') as overdue_count,
                COUNT(*) FILTER (WHERE is_completed = false AND deadline::date = CURRENT_DATE) as due_today
            FROM notifications
            WHERE user_id = %s
            """,
            (user_id,)
        )
        summary = cur.fetchone()

        # 4. Get urgent items (critical/high, max 10)
        cur.execute(
            """
            SELECT n.id, n.category, c.course_code as course, n.message_text as text, 
                   n.deadline, n.urgency_label as urgency, n.urgency_score, n.source_type as source
            FROM notifications n
            LEFT JOIN courses c ON n.course_id = c.id
            WHERE n.user_id = %s AND n.is_completed = false 
              AND n.urgency_label IN ('critical', 'high')
            ORDER BY n.urgency_score DESC
            LIMIT 10
            """,
            (user_id,)
        )
        urgent_items = cur.fetchall()

        # 5. Get pending items (low/medium, max 15)
        cur.execute(
            """
            SELECT n.id, n.category, c.course_code as course, n.message_text as text, 
                   n.deadline, n.urgency_label as urgency, n.source_type as source
            FROM notifications n
            LEFT JOIN courses c ON n.course_id = c.id
            WHERE n.user_id = %s AND n.is_completed = false 
              AND n.urgency_label NOT IN ('critical', 'high', 'overdue')
            ORDER BY n.deadline ASC NULLS LAST
            LIMIT 15
            """,
            (user_id,)
        )
        pending_items = cur.fetchall()

        # 6. Get today's announcements (max 5)
        cur.execute(
            """
            SELECT n.id, c.course_code as course, n.message_text as text, n.received_at
            FROM notifications n
            LEFT JOIN courses c ON n.course_id = c.id
            WHERE n.user_id = %s AND n.category = 'announcement'
              AND n.received_at::date = CURRENT_DATE
            ORDER BY n.received_at DESC
            LIMIT 5
            """,
            (user_id,)
        )
        announcements = cur.fetchall()

        # 7. Get today's timetable (max 8)
        # PostgreSQL extract(dow from CURRENT_DATE) returns 0 for Sunday to 6 for Saturday
        # Schema uses 1-7, we'll assume 1 is Monday, 7 is Sunday
        cur.execute(
            """
            SELECT c.course_code, c.course_name, t.start_time, t.end_time, t.room_number
            FROM timetable_entries t
            JOIN courses c ON t.course_id = c.id
            WHERE t.user_id = %s AND t.day_of_week = CASE 
                WHEN extract(dow from CURRENT_DATE) = 0 THEN 7 
                ELSE extract(dow from CURRENT_DATE) 
            END
            ORDER BY t.start_time
            LIMIT 8
            """,
            (user_id,)
        )
        timetable = cur.fetchall()

        return {
            "student": student,
            "courses": courses,
            "summary": summary,
            "urgent_items": urgent_items,
            "pending_items": pending_items,
            "announcements": announcements,
            "timetable": timetable
        }
    finally:
        cur.close()
        conn.close()

def create_user_account(full_name, email, password_hash, phone=None, university=None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO users (full_name, email, whatsapp_number, university, password_hash)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (full_name, email, phone, university, password_hash),
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        
        # Seed default abbreviations for new user
        from notification_abbr import seed_default_abbreviations
        seed_default_abbreviations(user_id)
        
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
