# Data Dictionary
**Project:** AI Student Academic Risk Early Warning System  
**Version:** 2.0 (Post-Audit Validated Schema)  
**Date:** October 2026  

---

## 1. Student Master Entity (`students.csv`)

| Field Name | Data Type | Nullable | Allowed Values / Range | Description | Source / Derivation |
|---|---|---|---|---|---|
| `student_id` | String | No | Pattern `^2428[A-Z0-9]{2,6}[0-9]{4}$` | Unique identifier for each student. | Synthetic Master Key |
| `student_name` | String | No | Non-empty text | Student full name (synthetic demo names). | Synthetic Master |
| `department_code` | String | No | `CS`, `CSE`, `CSEAIML`, `CSIT`, `ECE`, `EEE`, `IT`, `ME` | Standard engineering department code. | Synthetic Master |
| `department_name` | String | No | Non-empty department title | Full official department title. | Synthetic Master |
| `section` | String | No | `A`, `B`, `C`, `D` | Classroom cohort section. | Synthetic Master |
| `program` | String | No | `B.Tech` | Academic degree program. | Academic Program |
| `batch_year` | Integer | No | `2028` | Graduation year for the 2024–2028 batch. | Academic Program |
| `current_semester` | Integer | No | `5` | Active enrolled semester. | Academic Progress |

---

## 2. Subject Catalog Entity (`subject_catalog.csv`)

| Field Name | Data Type | Nullable | Allowed Values / Range | Description | Source / Derivation |
|---|---|---|---|---|---|
| `department_code` | String | No | `CS`, `CSE`, `CSEAIML`, `CSIT`, `ECE`, `EEE`, `IT`, `ME` | Department offering or prescribing the course. | Department Syllabus |
| `semester` | Integer | No | `1` to `5` | Semester in which course is prescribed. | Curriculum Syllabus |
| `subject_id` | String | No | e.g. `MA101L`, `IT301L` | Departmental or university course code. | Curriculum Syllabus |
| `subject_key` | String | No | e.g. `CS_IT301L`, `IT_IT301L` | Collision-free composite key (`dept + '_' + subject_id`). | Derived Composite Key |
| `subject_name` | String | No | Non-empty course title | Official course title (display metadata). | Curriculum Syllabus |
| `component` | String | No | `THEORY`, `PRACTICAL`, `BLENDED`, `AUDIT`, `PROFESSIONAL ELECTIVE-I`, `PROFESSIONAL ELECTIVE-II` | Academic pedagogical delivery mode. | Curriculum Syllabus |
| `credits` | Integer | No | `0` to `4` | Credit points awarded upon successful completion. | Curriculum Syllabus |

---

## 3. Academic Records Entity (`academic_records.csv`)

| Field Name | Data Type | Nullable | Allowed Values / Range | Description | Source / Derivation |
|---|---|---|---|---|---|
| `student_id` | String | No | Matches `students.student_id` | Foreign key referencing student master. | Join Key |
| `department_code` | String | No | Matches student department | Enrolled department code. | Join Key |
| `section` | String | No | `A`, `B`, `C`, `D` | Enrolled section. | Join Key |
| `semester` | Integer | No | `1` to `5` | Semester of course enrollment. | Join Key |
| `subject_id` | String | No | Matches catalog course code | Subject code. | Join Key |
| `subject_key` | String | No | e.g. `CS_IT301L` | Collision-free composite course key. | Derived Key |
| `subject_name` | String | No | Non-empty text | Display title of the course. | Display Metadata |
| `component` | String | No | Matches catalog component | Course delivery component. | Catalog Attribute |
| `credits` | Integer | No | `0` to `4` | Course credit weight. | Catalog Attribute |
| `classes_attended` | Integer | No | `0` to `total_classes` | Number of scheduled lectures/labs attended. | Synthetic Log |
| `total_classes` | Integer | No | `36` to `50` | Total scheduled instructional sessions. | Synthetic Log |
| `attendance_percentage` | Float | No | `0.0` to `100.0` | Course attendance rate: `(attended / total) * 100`. | Computed Ratio |
| `mid_sem_marks` | Float | No | `0.0` to `mid_sem_max` | Score achieved in Mid Semester examination. | Internal Assessment |
| `mid_sem_max` | Float | No | `30.0` (or `0.0` for non-theory) | Maximum attainable Mid Semester marks. | Syllabus Scheme |
| `class_test_1_marks` | Float | No | `0.0` to `10.0` | Score achieved in Class Test 1. | Internal Assessment |
| `class_test_1_max` | Float | No | `10.0` | Maximum attainable Class Test 1 marks. | Syllabus Scheme |
| `class_test_2_marks` | Float | No | `0.0` to `10.0` | Score achieved in Class Test 2. | Internal Assessment |
| `class_test_2_max` | Float | No | `10.0` | Maximum attainable Class Test 2 marks. | Syllabus Scheme |
| `assignments_submitted`| Integer | No | `0` to `total_assignments` | Number of homework assignments turned in. | Assessment Log |
| `total_assignments` | Integer | No | `3` to `6` | Total homework assignments assigned. | Assessment Log |
| `assignments_pending` | Integer | No | `total - submitted` | Number of incomplete or missing assignments. | Computed Count |
| `assignment_marks` | Float | No | `0.0` to `assignment_max` | Aggregated points obtained across assignments. | Internal Assessment |
| `assignment_max` | Float | No | `15.0` to `30.0` (varies by count) | Maximum total assignment points (`count * 5`). | Syllabus Scheme |
| `other_internal_marks`| Float | No | `0.0` to `other_internal_max` | Scores in tutorial, viva, or lab assessments. | Internal Assessment |
| `other_internal_max` | Float | No | `5.0` | Maximum attainable other internal marks. | Syllabus Scheme |
| `end_sem_marks` | Float | No | `0.0` to `end_sem_max` | End Semester Examination (ESE) score. | Terminal Outcome |
| `end_sem_max` | Float | No | `50.0` | Maximum attainable ESE score. | Syllabus Scheme |
| `grand_total_marks` | Float | No | `0.0` to `grand_total_max` | Sum of all component scores. | Computed Sum |
| `grand_total_max` | Float | No | `100.0` to `125.0` | Sum of all component maximums. | Computed Sum |
| `grand_total_percentage`| Float | No | `0.0` to `100.0` | Overall subject score percentage. | Computed Percentage |
| `subject_result` | String | No | `Pass`, `Fail` | Provisional result (`Pass` if $\ge 40\%$, else `Fail`). | Synthetic Outcome |

---

## 4. Semester Summary Entity (`semester_summary_cgpa_risk.csv`)

| Field Name | Data Type | Nullable | Allowed Values / Range | Description | Source / Derivation |
|---|---|---|---|---|---|
| `student_id` | String | No | Matches `students.student_id` | Reference to student. | Join Key |
| `department_code` | String | No | Department code | Student department. | Master Key |
| `section` | String | No | `A`, `B`, `C`, `D` | Section. | Master Key |
| `semester` | Integer | No | `1` to `5` | Academic semester evaluated. | Join Key |
| `semester_gpa_synthetic` | Float | No | `0.0` to `10.0` | Simulated Grade Point Average for the semester. | Synthetic Metric |
| `cumulative_cgpa_synthetic` | Float | No | `0.0` to `10.0` | Simulated cumulative GPA across completed terms. | Synthetic Metric |
| `semester_attendance_percentage` | Float | No | `0.0` to `100.0` | Arithmetic mean of course attendances in term. | Computed Aggregate |
| `semester_weighted_marks_percentage` | Float | No | `0.0` to `100.0` | Overall weighted marks percentage for term. | Computed Aggregate |
| `pending_assignments_total` | Integer | No | $\ge 0$ | Total pending assignments across all term courses. | Computed Sum |
| `subjects_passed` | Integer | No | `0` to `subjects_total` | Count of courses with `subject_result == "Pass"`. | Computed Count |
| `subjects_total` | Integer | No | `9` to `12` | Total enrolled courses in the term. | Enrolled Count |

---

## 5. Granular Assessment Log Entity (`assessment_details.csv`)

| Field Name | Data Type | Nullable | Allowed Values / Range | Description | Source / Derivation |
|---|---|---|---|---|---|
| `student_id` | String | No | Student foreign key | Reference to student. | Master Key |
| `department_code` | String | No | Department code | Department code. | Master Key |
| `section` | String | No | Section code | Section. | Master Key |
| `semester` | Integer | No | `1` to `5` | Semester. | Master Key |
| `subject_id` | String | No | Course code | Subject ID. | Catalog Key |
| `subject_key` | String | No | e.g. `CS_IT301L` | Composite subject identifier. | Derived Key |
| `subject_name` | String | No | Course name | Subject display name. | Display Metadata |
| `assessment_type` | String | No | `Mid Semester`, `Class Test`, `Assignment`, `Other Internal`, `End Semester` | Category of assessment. | Assessment Type |
| `assessment_number` | Integer | No | `1` to `6` | Sequence number within assessment type. | Sequence Counter |
| `marks_obtained` | Float | No | `0.0` to `max_marks` | Raw points scored by the student. | Evaluation Log |
| `max_marks` | Float | No | `5.0`, `10.0`, `30.0`, `50.0` | Point scale for the assessment. | Assessment Scheme |
| `submitted` | Boolean | Yes | `True`, `False`, `NaN` | Turn-in status (populated for assignments only). | Submission Status |

---

## 6. Support Plan & Checklist Entities (`support_plan_tasks.csv`, `task_checklist_progress.csv`)

| Entity | Field Name | Data Type | Nullable | Allowed Values / Range | Description |
|---|---|---|---|---|---|
| Tasks | `task_id` | String | No | e.g. `TASK000036` | Unique support task identifier. |
| Tasks | `student_id` | String | No | Valid student ID | Reference to student assigned. |
| Tasks | `subject_id` | String | No | Valid subject ID | Associated course needing remedial focus. |
| Tasks | `subject_key` | String | No | e.g. `CS_CS310L` | Composite course identifier. |
| Tasks | `task_status` | String | No | `In Progress`, `Completed`, `Pending Review` | High-level status of the intervention. |
| Tasks | `mentor_review_status` | String | No | `Approved`, `Pending`, `Needs Revision` | Faculty/mentor assessment status. |
| Tasks | `completion_percentage` | Float | No | `0.0` to `100.0` | Milestone progress: `(completed / total) * 100`. |
| Tasks | `assignment_sheet_assigned` | Boolean | No | `True`, `False` | Whether remedial practice sheets were given. |
| Checklist | `checklist_item_id` | String | No | e.g. `TASK000036_ITEM1` | Unique subtask milestone identifier. |
| Checklist | `task_id` | String | No | Matches `support_plan_tasks.task_id` | Foreign key referencing parent task. |
| Checklist | `checklist_item` | String | No | Milestone task text | Specific action item description. |
| Checklist | `is_completed` | String | No | `Yes`, `No` | Milestone fulfillment status. |
| Checklist | `completed_on` | String | Yes | ISO Date `YYYY-MM-DD` (or `NaN`) | Timestamp when marked completed. |

---

## 7. Model Predictions Entity (`subject_level_predictions.csv`)

| Field Name | Data Type | Nullable | Allowed Values / Range | Description | Source / Derivation |
|---|---|---|---|---|---|
| `student_id` | String | No | Valid student ID | Student reference. | Join Key |
| `subject_key` | String | No | Valid subject key | Course composite reference. | Join Key |
| `semester` | Integer | No | `1` to `5` | Enrolled term. | Join Key |
| `predicted_risk_probability` | Float | No | `0.0` to `1.0` | Model-estimated probability of scoring $< 40\%$ in ESE. | ML Pipeline Output |
| `predicted_below_40` | Integer | No | `0` or `1` | Binary class decision ($\ge 0.50 \rightarrow 1$, else $0$). | ML Decision Boundary |
| `predicted_risk_level` | String | No | `Low`, `Moderate`, `High` | Operational triage tier ($\le 0.30$ Low, $\le 0.60$ Moderate, $> 0.60$ High). | Triage Rule |

---

## 8. SHAP Explanations Entity (`individual_shap_explanations.csv`)

| Field Name | Data Type | Nullable | Allowed Values / Range | Description | Source / Derivation |
|---|---|---|---|---|---|
| `student_id` | String | No | Valid student ID | Student reference. | Join Key |
| `subject_key` | String | No | Valid subject key | Course composite reference. | Join Key |
| `semester` | Integer | No | `1` to `5` | Semester. | Join Key |
| `predicted_risk_probability` | Float | No | `0.0` to `1.0` | Target prediction explained. | Model Probability |
| `base_probability` | Float | No | $\approx 0.2262$ | Expected value / baseline probability across background cohort. | SHAP Expected Value |
| `reconstructed_probability` | Float | No | `0.0` to `1.0` | Full mathematical sum: `base_p + sum(all 371 shap values)`. | SHAP Reconstructed Value |
| `feature_rank` | Integer | No | `1` to `11` | Attribution rank (1 to 10 for top features, 11 for residual). | Ranking Counter |
| `feature_name` | String | No | e.g. `numeric__mid_semester_1`, `residual_other_features` | Name of the feature or aggregate residual. | Pipeline Feature Name |
| `feature_value_transformed` | Float | Yes | Standardized z-score, binary 1/0, or `NaN` (for residual) | Value fed into model classifier. | Scikit-learn Pipeline |
| `feature_value_original` | String | No | Formatted `%`, category match text, or residual label | Interpretable representation of feature for UI display. | UI Mapping Utility |
| `shap_value` | Float | No | Real number | Signed contribution to predicted below-40% probability. | PermutationExplainer |
| `impact_direction` | String | No | `increases/decreases predicted below-40% probability` | Plain-language directional impact. | Directional Formatter |
