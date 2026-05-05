-- Task #50: onboarding status columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS university TEXT,
ADD COLUMN IF NOT EXISTS degree TEXT,
ADD COLUMN IF NOT EXISTS semester TEXT;

-- Optional but used by /onboarding/progress to persist step payloads safely.
CREATE TABLE IF NOT EXISTS onboarding_progress (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    step INTEGER NOT NULL DEFAULT 0,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task #50: user settings table
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    gmail_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    classroom_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notification_sound BOOLEAN NOT NULL DEFAULT TRUE,
    daily_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    digest_time TIME NOT NULL DEFAULT '08:00',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task #52: archived notifications table
CREATE TABLE IF NOT EXISTS archived_notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL CHECK (
        source_type IN ('whatsapp', 'gmail', 'classroom', 'manual')
    ),
    source_reference_id TEXT,
    external_message_id TEXT,
    sender_name TEXT,
    message_text TEXT NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN (
            'assignment',
            'quiz',
            'announcement',
            'material',
            'event',
            'exam_schedule',
            'noise'
        )
    ),
    deadline TIMESTAMPTZ,
    urgency_score INTEGER NOT NULL DEFAULT 0,
    urgency_label TEXT NOT NULL DEFAULT 'none' CHECK (
        urgency_label IN ('none', 'low', 'medium', 'high', 'critical', 'overdue')
    ),
    urgency_level TEXT CHECK (
        urgency_level IN ('low', 'medium', 'high', 'critical', 'overdue')
    ),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expanded_text TEXT,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    semester_label TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_archived_notifications_user_semester
ON archived_notifications(user_id, semester_label, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_archived_notifications_user_category
ON archived_notifications(user_id, category);
