-- Course short names are the source of truth for course abbreviations such as OS, DB, NLP.
-- General abbreviation dictionary remains for non-course terms such as qz, assgn, kal, tmrw.

ALTER TABLE courses
ADD COLUMN IF NOT EXISTS short_name TEXT;

CREATE INDEX IF NOT EXISTS idx_courses_short_name_lower
ON courses (LOWER(short_name));

-- Optional cleanup: stop old course-category abbreviation rows from affecting future review lists.
-- The backend now ignores category = 'course' during abbreviation expansion.
-- DELETE FROM abbreviations WHERE category = 'course' AND source = 'system';
