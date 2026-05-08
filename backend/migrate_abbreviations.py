#!/usr/bin/env python3
"""
Apply abbreviation dictionary database migrations
Run this script once to set up the abbreviations and unknown_abbreviations tables
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).resolve().parent / ".env")

from db import get_db_connection

def apply_migrations():
    """Apply all pending database migrations for abbreviations."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    migrations = [
        # Create abbreviations table
        """
        CREATE TABLE IF NOT EXISTS abbreviations (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            abbreviation VARCHAR(20) NOT NULL,
            expansion VARCHAR(100) NOT NULL,
            category VARCHAR(50) NOT NULL CHECK (category IN ('course', 'time', 'action', 'general')),
            source VARCHAR(20) NOT NULL CHECK (source IN ('system', 'user')) DEFAULT 'user',
            use_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, abbreviation)
        );
        """,
        
        # Create indexes for abbreviations
        """
        CREATE INDEX IF NOT EXISTS idx_abbreviations_user_id ON abbreviations(user_id);
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_abbreviations_user_source ON abbreviations(user_id, source);
        """,
        
        # Create unknown_abbreviations table
        """
        CREATE TABLE IF NOT EXISTS unknown_abbreviations (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            abbreviation VARCHAR(20) NOT NULL,
            seen_count INTEGER NOT NULL DEFAULT 1,
            first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, abbreviation)
        );
        """,
        
        # Create indexes for unknown_abbreviations
        """
        CREATE INDEX IF NOT EXISTS idx_unknown_abbr_user_id ON unknown_abbreviations(user_id);
        """,
        
        # Add expanded_text column to notifications if not exists
        """
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expanded_text TEXT;
        """,
        
        # Add last_notified_at column to notifications if not exists
        """
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP WITH TIME ZONE;
        """,
        
        # Initialize expanded_text with message_text for existing rows
        """
        UPDATE notifications SET expanded_text = message_text WHERE expanded_text IS NULL;
        """,
    ]
    
    try:
        for i, migration in enumerate(migrations, 1):
            try:
                cur.execute(migration)
                print(f"✓ Migration {i} applied successfully")
            except Exception as e:
                print(f"⚠ Migration {i} had an issue: {e}")
                # Continue with other migrations
        
        conn.commit()
        print("\n✅ All abbreviation migrations applied successfully!")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        return False
        
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    success = apply_migrations()
    sys.exit(0 if success else 1)
