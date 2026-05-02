ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS urgency_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS urgency_label TEXT NOT NULL DEFAULT 'none';

ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS chk_notifications_urgency_label;

ALTER TABLE notifications
ADD CONSTRAINT chk_notifications_urgency_label
CHECK (
    urgency_label IN (
        'none',
        'low',
        'medium',
        'high',
        'critical',
        'overdue'
    )
);

ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_category_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_category_check
CHECK (
    category IN (
        'assignment',
        'quiz',
        'announcement',
        'material',
        'event',
        'exam_schedule',
        'noise'
    )
);
