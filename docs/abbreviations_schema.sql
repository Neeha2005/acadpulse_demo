-- Abbreviations table for per-user abbreviation dictionary
CREATE TABLE IF NOT EXISTS abbreviations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    abbreviation VARCHAR(20) NOT NULL,
    expansion VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('course', 'time', 'action', 'general')),
    source VARCHAR(20) NOT NULL CHECK (source IN ('system', 'user')) DEFAULT 'user',
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, abbreviation)
);

CREATE INDEX idx_abbreviations_user_id ON abbreviations(user_id);
CREATE INDEX idx_abbreviations_user_source ON abbreviations(user_id, source);

-- Unknown abbreviations table for auto-detection
CREATE TABLE IF NOT EXISTS unknown_abbreviations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    abbreviation VARCHAR(20) NOT NULL,
    seen_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, abbreviation)
);

CREATE INDEX idx_unknown_abbr_user_id ON unknown_abbreviations(user_id);

-- Add expanded_text column to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expanded_text TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP WITH TIME ZONE;

-- Update expanded_text with original message_text if null (for existing rows)
UPDATE notifications SET expanded_text = message_text WHERE expanded_text IS NULL;
