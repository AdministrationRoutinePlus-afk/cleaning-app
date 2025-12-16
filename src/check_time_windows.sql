-- Check if job templates have time windows set
SELECT 
  job_code,
  title,
  time_window_start,
  time_window_end,
  window_start_day,
  window_end_day
FROM job_templates
LIMIT 5;
