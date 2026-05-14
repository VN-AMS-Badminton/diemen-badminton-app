-- Add 'passed' source for slot-passing feature (subscriber/drop-in passes session slot to another player)
ALTER TYPE attendance_source ADD VALUE IF NOT EXISTS 'passed';
