-- Safe only after application code no longer depends on application_scope.
-- Existing definitions and Dental Chart history are not deleted or rewritten.
ALTER TABLE dental_chart_definitions DROP COLUMN application_scope;
