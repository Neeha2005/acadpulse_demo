-- =====================================================
-- AcadPulse PostgreSQL Schema
-- Supabase Compatible
-- =====================================================

-- Required Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. USERS
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    whatsapp_number TEXT,
    gmail_connected BOOLEAN NOT NULL DEFAULT FALSE,
    classroom_connected BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_connected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. COURSES
-- =====================================================
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL
);

-- =====================================================
-- 3. COURSE ALIASES
-- =====================================================
CREATE TABLE course_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    UNIQUE(course_id, alias)
);

-- =====================================================
-- 4. USER COURSES
-- =====================================================
CREATE TABLE user_courses (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    professor_name TEXT,
    PRIMARY KEY (user_id, course_id)
);

-- =====================================================
-- 5. WHATSAPP GROUPS
-- =====================================================
CREATE TABLE whatsapp_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_group_id TEXT UNIQUE NOT NULL,
    group_name TEXT NOT NULL,
    is_general BOOLEAN NOT NULL DEFAULT FALSE
);

-- =====================================================
-- 6. USER WHATSAPP GROUPS
-- =====================================================
CREATE TABLE user_whatsapp_groups (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    whatsapp_group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, whatsapp_group_id)
);

-- =====================================================
-- 7. CLASSROOM COURSES
-- =====================================================
CREATE TABLE classroom_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id TEXT UNIQUE NOT NULL,
    classroom_name TEXT NOT NULL
);

-- =====================================================
-- 8. USER CLASSROOM COURSES
-- =====================================================
CREATE TABLE user_classroom_courses (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    classroom_course_id UUID NOT NULL REFERENCES classroom_courses(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, classroom_course_id)
);

-- =====================================================
-- 9. COURSE SOURCE MAPPINGS
-- =====================================================
CREATE TABLE course_source_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (
        source_type IN ('whatsapp', 'gmail', 'classroom')
    ),
    source_reference_id TEXT NOT NULL
    -- Examples:
    -- WhatsApp  : '120363418273@g.us'
    -- Classroom : '684219537821'
    -- Gmail     : 'professor@university.edu'
);

-- =====================================================
-- 10. NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,

    source_type TEXT NOT NULL CHECK (
        source_type IN ('whatsapp', 'gmail', 'classroom', 'manual')
    ),

    source_reference_id TEXT NOT NULL,
    -- Examples:
    -- WhatsApp Group ID : '120363418273@g.us'
    -- Classroom ID      : '684219537821'
    -- Gmail Sender      : 'professor@university.edu'

    external_message_id TEXT NOT NULL,
    -- Examples:
    -- WhatsApp : '3EB0C767D9C1A34F'
    -- Gmail    : '18d7f4c1eab920ef'
    -- Classroom: 'announcement-987654321'

    sender_name TEXT,

    message_text TEXT NOT NULL,

    category TEXT NOT NULL CHECK (
        category IN (
            'assignment',
            'quiz',
            'announcement',
            'material',
            'event',
            'exam_schedule'
        )
    ),

    deadline TIMESTAMPTZ,

    urgency_level TEXT CHECK (
        urgency_level IN (
            'low',
            'medium',
            'high',
            'critical',
            'overdue'
        )
    ),

    is_completed BOOLEAN NOT NULL DEFAULT FALSE,

    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate notifications
CREATE UNIQUE INDEX idx_notifications_unique_source_message
ON notifications(user_id, source_type, external_message_id);

-- =====================================================
-- 11. TIMETABLE ENTRIES
-- =====================================================
CREATE TABLE timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

    day_of_week INTEGER NOT NULL CHECK (
        day_of_week BETWEEN 1 AND 7
    ),

    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    room_number TEXT
);

-- =====================================================
-- 12. ATTACHMENTS
-- =====================================================
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================
CREATE INDEX idx_notifications_user_received
ON notifications(user_id, received_at DESC);

CREATE INDEX idx_notifications_course_deadline
ON notifications(course_id, deadline);

CREATE INDEX idx_course_source_lookup
ON course_source_mappings(user_id, source_type, source_reference_id);

CREATE INDEX idx_timetable_user_day
ON timetable_entries(user_id, day_of_week, start_time);