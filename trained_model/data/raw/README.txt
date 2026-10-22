UPDATED KIET-STYLE ACADEMIC RISK DATASET

All student names and academic records are fictional/synthetic demo data, not real KIET records. IDs follow 2428 + department code without hyphens + unique four-digit suffix (1000-9999, unique within department). Batch is 2024-2028 and batch_year is 2028.

Removed: data_type and catalog_status columns.

CS subjects: Semesters 1-4 are based on uploaded grade cards where readable; Semester 5 follows the user's supplied subject list. CS Sem 4 Professional Elective-I and Sem 5 Professional Elective-II are represented as previously discussed. Other department curricula are illustrative placeholders and must be verified against official syllabi.

Files: students.csv; subject_catalog.csv; academic_records.csv; semester_summary_cgpa_risk.csv; assessment_details.csv; support_plan_tasks.csv; task_checklist_progress.csv; complete_connected_dataset.csv; department_counts.csv.

Pass/fail: subject_result is Pass when grand_total_percentage >= 40, otherwise Fail. Semester summary includes a short remark explaining risk indicators.

Task completion: support_plan_tasks.csv includes assignment_sheet_assigned, assignment_sheet_name, checklist_items_total, checklist_items_completed and completion_percentage. completion_percentage = checklist_items_completed / checklist_items_total * 100. task_checklist_progress.csv stores individual milestones; update is_completed and recalculate percentage in the application for live tracking.

Model caution: all marks, attendance, CGPA and synthetic risk indicators are simulated. Risk labels are heuristic proxies, not validated outcomes. Do not use future end-semester results as inputs for early-warning predictions; split evaluation by student_id and validate with authorized, anonymized real records. Marks scheme is illustrative and grand_total_max varies with assignment count.
Section column placement update:
- In student-level and student-linked CSV files, section is placed immediately after department_name when that column exists.
- In student-linked files without department_name, section is placed immediately after department_code.
- department_counts.csv now reports student_count by department_code, department_name, and section. Counts are derived from students.csv.
- subject_catalog.csv and task_checklist_progress.csv remain section-free because their rows describe shared subject catalog entries and task checklist items rather than student-specific records.


DATASET CLEANUP UPDATE (2026-10-20)
Removed academic_risk_score_synthetic, academic_risk_label_synthetic, and remark from CSV files where present. These were heuristic/synthetic indicators and were not validated outcomes; keeping them could encourage a model to reproduce generated rules rather than learn ESE failure risk.
No replacement risk label has been fabricated. The dataset currently does not contain a validated subject-level pre-ESE risk target. To train the intended early-warning model, define a target from a verified subject-level ESE outcome/pass criterion, then use only information available before ESE as features. Do not use end-semester marks as model inputs.
All remaining academic records are still synthetic demo data and should not be treated as real-world evidence.
