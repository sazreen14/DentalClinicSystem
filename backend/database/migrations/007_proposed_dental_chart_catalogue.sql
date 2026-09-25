START TRANSACTION;

INSERT INTO dental_chart_definitions
  (definition_id, code, label, category, display_color, symbol_key, pattern_key, application_scope, is_active, is_development)
VALUES
  ('DCD-PROP-CARIES',     'PROP-CARIES',     'Caries',                          'Condition',           '#EF4444', 'ring', NULL, 'WHOLE_OR_SURFACES', TRUE, FALSE),
  ('DCD-PROP-EXIST-FILL', 'PROP-EXIST-FILL', 'Existing Filling',                'Existing Treatment',  '#2563EB', 'fill', NULL, 'SURFACES',          TRUE, FALSE),
  ('DCD-PROP-MISSING',    'PROP-MISSING',    'Missing Tooth',                   'Condition',           '#64748B', 'ring', NULL, 'WHOLE',             TRUE, FALSE),
  ('DCD-PROP-PLAN-FILL',  'PROP-PLAN-FILL',  'Planned Filling',                 'Planned Treatment',   '#F59E0B', 'dot',  NULL, 'SURFACES',          TRUE, FALSE),
  ('DCD-PROP-COMP-FILL',  'PROP-COMP-FILL',  'Completed Filling',               'Completed Treatment', '#22C55E', 'fill', NULL, 'SURFACES',          TRUE, FALSE),
  ('DCD-PROP-PLAN-EXT',   'PROP-PLAN-EXT',   'Extraction Planned',              'Planned Treatment',   '#9333EA', 'dot',  NULL, 'WHOLE',             TRUE, FALSE),
  ('DCD-PROP-EXTRACTED',  'PROP-EXTRACTED',  'Extracted Tooth',                 'Completed Treatment', '#1F2937', 'ring', NULL, 'WHOLE',             TRUE, FALSE),
  ('DCD-PROP-CROWN',      'PROP-CROWN',      'Crown',                           'Existing Treatment',  '#14B8A6', 'ring', NULL, 'WHOLE',             TRUE, FALSE),
  ('DCD-PROP-EXIST-RCT',  'PROP-EXIST-RCT',  'Existing Root Canal Treatment',   'Existing Treatment',  '#92400E', 'fill', NULL, 'WHOLE',             TRUE, FALSE),
  ('DCD-PROP-COMP-RCT',   'PROP-COMP-RCT',   'Completed Root Canal Treatment',  'Completed Treatment', '#15803D', 'fill', NULL, 'WHOLE',             TRUE, FALSE)
ON DUPLICATE KEY UPDATE
  label = IF(definition_id = VALUES(definition_id) AND code = VALUES(code), VALUES(label), label),
  category = IF(definition_id = VALUES(definition_id) AND code = VALUES(code), VALUES(category), category),
  display_color = IF(definition_id = VALUES(definition_id) AND code = VALUES(code), VALUES(display_color), display_color),
  symbol_key = IF(definition_id = VALUES(definition_id) AND code = VALUES(code), VALUES(symbol_key), symbol_key),
  pattern_key = IF(definition_id = VALUES(definition_id) AND code = VALUES(code), VALUES(pattern_key), pattern_key),
  application_scope = IF(definition_id = VALUES(definition_id) AND code = VALUES(code), VALUES(application_scope), application_scope),
  is_active = IF(definition_id = VALUES(definition_id) AND code = VALUES(code), TRUE, is_active),
  is_development = IF(definition_id = VALUES(definition_id) AND code = VALUES(code), FALSE, is_development);

UPDATE dental_chart_definitions
SET is_active = FALSE
WHERE code IN ('DEV-OBS','DEV-COND','DEV-PROC','TEST-9d226bf2','TEST-6c77d1d7','TEST-fdeac121');

COMMIT;
