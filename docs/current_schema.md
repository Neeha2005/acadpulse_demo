

## Complete Database Schema

### Table: `attachments`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| id | uuid | NO | gen_random_uuid() |
| notification_id | uuid | NO | null |
| file_name | text | NO | null |
| file_path | text | NO | null |
| file_type | text | NO | null |

### Table: `classroom_courses`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| id | uuid | NO | gen_random_uuid() |
| classroom_id | text | NO | null |
| classroom_name | text | NO | null |

### Table: `course_aliases`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| id | uuid | NO | gen_random_uuid() |
| course_id | uuid | NO | null |
| alias | text | NO | null |

### Table: `course_source_mappings`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | null |
| course_id | uuid | NO | null |
| source_type | text | NO | null |
| source_reference_id | text | NO | null |

### Table: `courses`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| id | uuid | NO | gen_random_uuid() |
| course_code | text | NO | null |
| course_name | text | NO | null |
| short_name | text | YES | null |

### Table: `notifications`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | null |
| course_id | uuid | YES | null |
| source_type | text | NO | null |
| source_reference_id | text | YES | null |
| external_message_id | text | YES | null |
| sender_name | text | YES | null |
| message_text | text | NO | null |
| category | text | NO | null |
| deadline | timestamp with time zone | YES | null |
| urgency_level | text | YES | null |
| is_completed | boolean | NO | false |
| received_at | timestamp with time zone | NO | null |
| created_at | timestamp with time zone | NO | now() |

### Table: `onboarding_progress`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| user_id | uuid | NO | null |
| step | integer | NO | 0 |
| data | jsonb | NO | '{}'::jsonb |
| updated_at | timestamp with time zone | NO | now() |

### Table: `timetable_entries`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | null |
| course_id | uuid | NO | null |
| day_of_week | integer | NO | null |
| start_time | time without time zone | NO | null |
| end_time | time without time zone | NO | null |
| room_number | text | YES | null |

### Table: `user_classroom_courses`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| user_id | uuid | NO | null |
| classroom_course_id | uuid | NO | null |

### Table: `user_courses`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| user_id | uuid | NO | null |
| course_id | uuid | NO | null |
| professor_name | text | YES | null |

### Table: `user_settings`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| user_id | uuid | NO | null |
| whatsapp_enabled | boolean | NO | true |
| gmail_enabled | boolean | NO | true |
| classroom_enabled | boolean | NO | true |
| notification_sound | boolean | NO | true |
| daily_digest_enabled | boolean | NO | false |
| digest_time | time without time zone | NO | '08:00:00'::time without time zone |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### Table: `user_whatsapp_groups`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| user_id | uuid | NO | null |
| whatsapp_group_id | uuid | NO | null |

### Table: `users`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| id | uuid | NO | gen_random_uuid() |
| full_name | text | NO | null |
| email | text | YES | null |
| whatsapp_number | text | YES | null |
| gmail_connected | boolean | NO | false |
| classroom_connected | boolean | NO | false |
| whatsapp_connected | boolean | NO | false |
| created_at | timestamp with time zone | NO | now() |
| university | text | YES | null |
| degree | text | YES | null |
| semester | text | YES | null |
| onboarding_completed | boolean | NO | false |
| onboarding_step | integer | NO | 0 |
| password_hash | text | YES | null |

### Table: `whatsapp_groups`

| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| id | uuid | NO | gen_random_uuid() |
| whatsapp_group_id | text | NO | null |
| group_name | text | NO | null |
| is_general | boolean | NO | false |

## Summary

**Total Tables:** 15

**Default Values Summary:**
- `gen_random_uuid()` - UUID primary keys
- `now()` / `CURRENT_TIMESTAMP` - Timestamp columns
- `true` - Enabled features (whatsapp_enabled, gmail_enabled, classroom_enabled, notification_sound)
- `false` - Disabled features and flags
- `0` - Integer counters and steps
- `'{}'::jsonb` - JSON data field
- `'08:00:00'` - Default digest time