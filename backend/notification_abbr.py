"""
Abbreviation Dictionary System for AcadPulse
Handles per-user abbreviation expansion, caching, and auto-learning
"""

import re
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple, Optional
from threading import Thread
from db import get_db_connection

logger = logging.getLogger(__name__)
PAKISTAN_TZ = __import__('pytz').timezone("Asia/Karachi")

# In-memory cache: {user_id: (timestamp, {abbr: expansion})}
_abbr_cache: Dict[int, Tuple[datetime, Dict[str, str]]] = {}
CACHE_TTL_MINUTES = 10

# Default system abbreviations
DEFAULT_SYSTEM_ABBREVIATIONS = {
    "time": {
        "kal": "tomorrow",
        "aaj": "today",
        "parso": "day after tomorrow",
        "raat": "night",
        "subah": "morning",
        "shaam": "evening",
        "abhi": "right now",
        "jaldi": "quickly / soon",
        "tmrw": "tomorrow",
        "tdy": "today",
        "tonite": "tonight",
    },
    "action": {
        "DL": "deadline",
        "sub": "subject",
        "lec": "lecture",
        "prac": "practical",
        "assgn": "assignment",
        "qz": "quiz",
        "mid": "midterm",
        "fin": "final exam",
        "proj": "project",
        "ppt": "presentation",
        "viva": "viva voce exam",
        "HW": "homework",
        "marks": "marks",
    },
    "general": {
        "OK": "OK",
        "PM": "PM",
        "AM": "AM",
    },
}


def seed_default_abbreviations(user_id: int) -> bool:
    """
    Seed default system abbreviations for a new user.
    Returns True if successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        for category, abbrs_dict in DEFAULT_SYSTEM_ABBREVIATIONS.items():
            for abbr, expansion in abbrs_dict.items():
                cur.execute(
                    """
                    INSERT INTO abbreviations 
                    (user_id, abbreviation, expansion, category, source)
                    VALUES (%s, %s, %s, %s, 'system')
                    ON CONFLICT (user_id, abbreviation) DO NOTHING
                    """,
                    (user_id, abbr.lower(), expansion, category),
                )
        conn.commit()
        logger.info(f"Seeded default abbreviations for user {user_id}")
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Error seeding abbreviations for user {user_id}: {e}")
        return False
    finally:
        cur.close()
        conn.close()


def _load_user_abbreviations(user_id: int) -> Dict[str, str]:
    """Load user's abbreviation dictionary from database."""
    conn = get_db_connection()
    cur = conn.cursor()
    abbr_dict = {}
    try:
        cur.execute(
            """
            SELECT abbreviation, expansion
            FROM abbreviations
            WHERE user_id = %s
              AND category <> 'course'
            ORDER BY LENGTH(abbreviation) DESC
            """,
            (user_id,),
        )
        for row in cur.fetchall():
            abbr_dict[row[0].lower()] = row[1]
        return abbr_dict
    except Exception as e:
        logger.error(f"Error loading abbreviations for user {user_id}: {e}")
        return {}
    finally:
        cur.close()
        conn.close()


def _load_user_course_terms(user_id: int) -> set:
    """Load course codes, short names, names, and aliases so they are not treated as unknown abbreviations."""
    conn = get_db_connection()
    cur = conn.cursor()
    terms = set()
    try:
        cur.execute(
            """
            SELECT c.course_code, c.short_name, c.course_name, ca.alias
            FROM courses c
            JOIN user_courses uc ON uc.course_id = c.id
            LEFT JOIN course_aliases ca ON ca.course_id = c.id
            WHERE uc.user_id = %s
            """,
            (user_id,),
        )
        for row in cur.fetchall():
            for value in row:
                if value:
                    terms.add(str(value).strip().lower())
        return terms
    except Exception as e:
        logger.debug(f"Error loading course terms for unknown abbreviation detection: {e}")
        return set()
    finally:
        cur.close()
        conn.close()


def _get_cached_abbreviations(user_id: int) -> Dict[str, str]:
    """
    Get user's abbreviations from cache or load from DB.
    Cache expires after CACHE_TTL_MINUTES.
    """
    now = datetime.now(PAKISTAN_TZ)
    if user_id in _abbr_cache:
        cached_time, cached_dict = _abbr_cache[user_id]
        if (now - cached_time).total_seconds() < CACHE_TTL_MINUTES * 60:
            return cached_dict
    
    # Load from DB and cache
    abbr_dict = _load_user_abbreviations(user_id)
    _abbr_cache[user_id] = (now, abbr_dict)
    return abbr_dict


def _invalidate_abbr_cache(user_id: int) -> None:
    """Invalidate abbreviation cache for a user."""
    if user_id in _abbr_cache:
        del _abbr_cache[user_id]
    logger.debug(f"Invalidated abbreviation cache for user {user_id}")


def _increment_use_count(abbreviation: str, user_id: int) -> None:
    """Increment use_count for an abbreviation (runs in background thread)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE abbreviations
            SET use_count = use_count + 1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND abbreviation = %s
            """,
            (user_id, abbreviation.lower()),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.debug(f"Error incrementing use count: {e}")


def expand_abbreviations(text: str, user_id: int) -> str:
    """
    Expand abbreviations in text for a given user.
    
    Rules:
    - Case-insensitive matching
    - Whole-word matching only (using \b word boundaries)
    - Longer abbreviations matched before shorter ones
    - Roman Urdu time words get appended context in brackets
    - Single-pass replacement to avoid recursive expansion
    - use_count incremented in background thread
    - Returns original text if error or empty dictionary
    """
    if not text or not user_id:
        return text
    
    try:
        abbr_dict = _get_cached_abbreviations(user_id)
        if not abbr_dict:
            return text
        
        # Sort by length descending
        sorted_keys = sorted(abbr_dict.keys(), key=len, reverse=True)
        
        # Create a single regex pattern for all abbreviations
        # Use word boundaries \b for whole-word matching
        pattern = re.compile(
            r'\b(' + '|'.join(re.escape(k) for k in sorted_keys) + r')\b',
            re.IGNORECASE
        )
        
        matched_abbrs = []
        
        # Urdu time words for special bracketed context
        TIME_WORDS = {
            "kal", "aaj", "parso", "raat", "subah", "shaam", 
            "abhi", "jaldi", "tmrw", "tdy", "tonite"
        }
        
        def replace_match(match):
            original_match = match.group(0)
            abbr_lower = original_match.lower()
            expansion = abbr_dict[abbr_lower]
            matched_abbrs.append(abbr_lower)
            
            if abbr_lower in TIME_WORDS:
                return f"{expansion} ({original_match})"
            return expansion
        
        # Apply single-pass replacement
        expanded_text = pattern.sub(replace_match, text)
        
        # Increment use counts in background thread
        if matched_abbrs:
            def increment_counts():
                # Use a set to increment each matched abbreviation only once per message
                for abbr in set(matched_abbrs):
                    _increment_use_count(abbr, user_id)
            
            thread = Thread(target=increment_counts, daemon=True)
            thread.start()
        
        return expanded_text
    
    except Exception as e:
        logger.error(f"Error in expand_abbreviations: {e}")
        return text


def add_or_update_abbreviation(
    user_id: int,
    abbreviation: str,
    expansion: str,
    category: str = "general"
) -> Tuple[bool, Dict]:
    """
    Add or update a user-defined abbreviation.
    Validates input and invalidates cache.
    
    Returns: (success: bool, result: dict with created/updated entry)
    """
    # Validation
    if not abbreviation or len(abbreviation) > 20:
        return False, {"error": "Abbreviation must be 1-20 characters"}
    
    if not expansion or len(expansion) > 100:
        return False, {"error": "Expansion must be 1-100 characters"}
    
    if category not in ["time", "action", "general"]:
        return False, {"error": "Invalid category"}
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        abbr_lower = abbreviation.lower()
        cur.execute(
            """
            INSERT INTO abbreviations 
            (user_id, abbreviation, expansion, category, source, updated_at)
            VALUES (%s, %s, %s, %s, 'user', CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, abbreviation) DO UPDATE SET
                expansion = EXCLUDED.expansion,
                category = EXCLUDED.category,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, abbreviation, expansion, category, source, use_count, created_at, updated_at
            """,
            (user_id, abbr_lower, expansion, category),
        )
        result = cur.fetchone()
        conn.commit()
        
        # Invalidate cache
        _invalidate_abbr_cache(user_id)
        
        return True, {
            "id": result[0],
            "abbreviation": result[1],
            "expansion": result[2],
            "category": result[3],
            "source": result[4],
            "use_count": result[5],
            "created_at": result[6].isoformat(),
            "updated_at": result[7].isoformat(),
        }
    
    except Exception as e:
        conn.rollback()
        logger.error(f"Error adding abbreviation: {e}")
        return False, {"error": str(e)}
    finally:
        cur.close()
        conn.close()


def delete_abbreviation(user_id: int, abbreviation: str) -> Tuple[bool, str]:
    """
    Delete a user-defined abbreviation.
    Cannot delete system abbreviations.
    
    Returns: (success: bool, message: str)
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        abbr_lower = abbreviation.lower()
        
        # Check if abbreviation exists and is user-defined
        cur.execute(
            """
            SELECT source FROM abbreviations
            WHERE user_id = %s AND abbreviation = %s
            """,
            (user_id, abbr_lower),
        )
        result = cur.fetchone()
        
        if not result:
            return False, "Abbreviation not found"
        
        if result[0] == "system":
            return False, "System abbreviations cannot be deleted"
        
        # Delete user abbreviation
        cur.execute(
            """
            DELETE FROM abbreviations
            WHERE user_id = %s AND abbreviation = %s AND source = 'user'
            """,
            (user_id, abbr_lower),
        )
        conn.commit()
        
        # Invalidate cache
        _invalidate_abbr_cache(user_id)
        
        return True, f"Abbreviation '{abbreviation}' deleted"
    
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting abbreviation: {e}")
        return False, str(e)
    finally:
        cur.close()
        conn.close()


def get_user_abbreviations(user_id: int) -> Dict:
    """
    Get user's full abbreviation dictionary grouped by category.
    Separates system and user entries.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT category, abbreviation, expansion, source, use_count
            FROM abbreviations
            WHERE user_id = %s
              AND category <> 'course'
            ORDER BY category, abbreviation
            """,
            (user_id,),
        )
        
        system_abbrs = {}
        user_abbrs = {}
        
        for row in cur.fetchall():
            category, abbr, expansion, source, use_count = row
            entry = {"abbreviation": abbr, "expansion": expansion, "use_count": use_count}
            
            target_dict = system_abbrs if source == "system" else user_abbrs
            if category not in target_dict:
                target_dict[category] = []
            target_dict[category].append(entry)
        
        total_count = len(system_abbrs) + len(user_abbrs)
        
        return {
            "system": system_abbrs,
            "user": user_abbrs,
            "total_count": total_count,
        }
    
    except Exception as e:
        logger.error(f"Error getting abbreviations: {e}")
        return {"system": {}, "user": {}, "total_count": 0}
    finally:
        cur.close()
        conn.close()


def detect_unknown_abbreviations(text: str, user_id: int) -> List[str]:
    """
    Detect patterns that look like abbreviations but are NOT in dictionary.
    
    Detection rules:
    - All-caps words of 2-4 letters (not common words like OK, TV, PM, AM)
    - Words appearing 3+ times across messages
    
    Saves to unknown_abbreviations table, returns list of detected abbreviations.
    """
    if not text or not user_id:
        return []
    
    # Get existing non-course abbreviations
    abbr_dict = _get_cached_abbreviations(user_id)
    course_terms = _load_user_course_terms(user_id)
    
    # Common English words to exclude
    common_words = {"I", "A", "OK", "TV", "PM", "AM", "GO", "NO", "YES", "OR", "AND"}
    
    # Find all-caps words of 2-4 letters
    potential_abbrs = set()
    for match in re.finditer(r'\b[A-Z]{2,4}\b', text):
        word = match.group(0)
        if word not in common_words and word.lower() not in abbr_dict and word.lower() not in course_terms:
            potential_abbrs.add(word)
    
    conn = get_db_connection()
    cur = conn.cursor()
    detected = []
    
    try:
        for abbr in potential_abbrs:
            # Check if already in unknown_abbreviations
            cur.execute(
                """
                SELECT id, seen_count FROM unknown_abbreviations
                WHERE user_id = %s AND abbreviation = %s
                """,
                (user_id, abbr),
            )
            existing = cur.fetchone()
            
            if existing:
                # Update existing entry
                cur.execute(
                    """
                    UPDATE unknown_abbreviations
                    SET seen_count = seen_count + 1, last_seen_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s AND abbreviation = %s
                    """,
                    (user_id, abbr),
                )
            else:
                # Insert new entry
                cur.execute(
                    """
                    INSERT INTO unknown_abbreviations 
                    (user_id, abbreviation, seen_count)
                    VALUES (%s, %s, 1)
                    """,
                    (user_id, abbr),
                )
            
            detected.append(abbr)
        
        conn.commit()
        return detected
    
    except Exception as e:
        conn.rollback()
        logger.error(f"Error detecting unknown abbreviations: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def get_unknown_abbreviations(user_id: int, limit: int = 50) -> List[Dict]:
    """
    Get user's detected unknown abbreviations sorted by frequency.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT abbreviation, seen_count, first_seen_at, last_seen_at
            FROM unknown_abbreviations
            WHERE user_id = %s
            ORDER BY seen_count DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
        
        results = []
        for row in cur.fetchall():
            results.append({
                "abbreviation": row[0],
                "seen_count": row[1],
                "first_seen_at": row[2].isoformat(),
                "last_seen_at": row[3].isoformat(),
            })
        
        return results
    
    except Exception as e:
        logger.error(f"Error getting unknown abbreviations: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def update_last_notified(notification_id: int) -> bool:
    """Update last_notified_at timestamp for a notification."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE notifications
            SET last_notified_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (notification_id,),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating last_notified_at: {e}")
        return False
    finally:
        cur.close()
        conn.close()
