# Comprehensive Dataset Audit & Validation Report
**Project:** AI Student Academic Risk Early Warning System  
**Dataset:** KIET Batch 2024–2028 Academic Records (Synthetic Demo Dataset)  
**Execution Date:** October 2026  
**Auditor:** Antigravity AI  

---

## 1. Executive Summary

This audit represents the end-to-end data profiling, relational validation, academic logic verification, model-artifact consistency audit, and SHAP mathematical validation performed on the AI Student Academic Risk Early Warning System.

### Key Conclusions:
1. **Relational Integrity:** All 9 source CSV files have 100% referential integrity with zero orphan records and zero duplicate primary keys.
2. **Subject Collision Resolution:** Discovered and resolved a critical identifier collision where course code `IT301L` mapped to two distinct courses across departments. Implemented composite `subject_key = f"{department_code}_{subject_id}"` (231 unique courses across 8 departments).
3. **Collinearity Elimination:** Removed redundant one-hot encoding of `subject_id` and `subject_name`, preventing split SHAP attributions and reducing model complexity.
4. **Prediction Coverage:** 100% coverage achieved across the entire cohort (47,550 student-subject records). Every record maps 1:1 to an eligible course record with probabilities strictly in $[0, 1]$.
5. **SHAP Additivity Closure:** Resolved the top-10 truncation discrepancy by introducing a calibrated `residual_other_features` row. The sum of the exported rows reconstructs the predicted model probability within $\le 7.77 \times 10^{-16}$ (far exceeding the $0.0001$ requirement).
6. **Automated Test Suite:** Established 18 automated unit and integration tests under `tests/` covering integrity, bounds, academic logic, leakage, and SHAP closure. Test pass rate is 100% (18/18).

---

## 2. Complete CSV Profiling (Phase 2)

| Dataset | File Name | Rows | Columns | Null Columns (Count, %) | Duplicate Rows | Candidate Primary Key | Key Uniqueness |
|---|---|---|---|---|---|---|---|
| **Students** | `students.csv` | 1,530 | 8 | None (0) | 0 | `student_id` | 100% Unique |
| **Catalog** | `subject_catalog.csv` | 231 | 6 | None (0) | 0 | `(department_code, subject_id)` | 100% Unique |
| **Academic Records** | `academic_records.csv` | 47,550 | 33 | None (0) | 0 | `(student_id, department_code, subject_id, semester)` | 100% Unique |
| **Semester Summary** | `semester_summary_cgpa_risk.csv` | 7,650 | 11 | None (0) | 0 | `(student_id, semester)` | 100% Unique |
| **Assessments** | `assessment_details.csv` | 451,500 | 11 | `submitted`: 237,750 (52.66%)* | 0 | `(student_id, department_code, subject_id, semester, assessment_type, assessment_number)` | 100% Unique |
| **Support Tasks** | `support_plan_tasks.csv` | 3,060 | 16 | `assignment_sheet_name`: 1,398 (45.69%)** | 0 | `task_id` | 100% Unique |
| **Checklist Progress** | `task_checklist_progress.csv` | 13,796 | 5 | `completed_on`: 6,818 (49.42%)*** | 0 | `checklist_item_id` | 100% Unique |
| **Complete Connected** | `complete_connected_dataset.csv` | 47,550 | 49 | None (0) | 0 | `(student_id, semester, subject_id)` | 100% Unique |
| **Department Counts** | `department_counts.csv` | 22 | 4 | None (0) | 0 | `(department_code, section)` | 100% Unique |
| **Subject Training Data** | `subject_level_training_data.csv` | 47,550 | 22 | `assignment_4`: 12,082 (25.41%)<br>`assignment_5`: 23,878 (50.22%)<br>`assignment_6`: 35,590 (74.85%)**** | 0 | `(student_id, subject_key, semester)` | 100% Unique |
| **Predictions** | `subject_level_predictions.csv` | 47,550 | 25 | Same assignment nulls as training data | 0 | `(student_id, subject_key, semester)` | 100% Unique |
| **SHAP Explanations** | `individual_shap_explanations.csv` | 1,100 | 16 | `feature_value_transformed`: 100 (9.09%)***** | 0 | `(student_id, subject_key, semester, feature_rank)` | 100% Unique |

### Profiling Observations & Distinctions:
- `*` **`submitted` in assessments:** Missing exclusively for non-assignment assessments (Mid Semester exams, Class Tests, Other Internals do not have a submission flag). This is valid structural absence.
- `**` **`assignment_sheet_name` in support tasks:** Null when `assignment_sheet_assigned == False`. Valid conditional relationship.
- `***` **`completed_on` in task checklists:** Null when `is_completed == "No"` (6,818 items). When `is_completed == "Yes"`, timestamp is populated (6,978 items). Valid state-dependent relationship.
- `****` **`assignment_4..6` in training data:** Valid curriculum variation. Courses have between 3 and 6 assignments depending on departmental syllabus. Handled appropriately by median imputation in the pipeline.
- `*****` **`feature_value_transformed` in explanations:** Null solely on Rank 11 (`residual_other_features`), which represents the mathematical aggregate of omitted features rather than a single transformed feature.

---

## 3. Relationship and Key Validation Matrix (Phase 3)

| Entity Relationship | Join Key | Expected Card. | Unmatched Left | Unmatched Right | Collisions / Dups | Status |
|---|---|---|---|---|---|---|
| `students.csv` $\rightarrow$ `academic_records.csv` | `student_id` | $1 : N$ | 0 | 0 | 0 | **VALID** |
| `students.csv` $\rightarrow$ `assessment_details.csv` | `student_id` | $1 : N$ | 0 | 0 | 0 | **VALID** |
| `subject_catalog.csv` $\rightarrow$ `academic_records.csv` | `subject_key` | $1 : N$ | 0 | 0 | 0 | **VALID** |
| `subject_catalog.csv` $\rightarrow$ `assessment_details.csv` | `subject_key` | $1 : N$ | 0 | 0 | 0 | **VALID** |
| `academic_records.csv` $\rightarrow$ `semester_summary.csv` | `(student_id, semester)` | $N : 1$ | 0 | 0 | 0 | **VALID** |
| `students.csv` $\rightarrow$ `support_plan_tasks.csv` | `student_id` | $1 : N$ | 0 | 0 | 0 | **VALID** |
| `support_plan_tasks.csv` $\rightarrow$ `task_checklist.csv` | `task_id` | $1 : N$ | 0 | 0 | 0 | **VALID** |
| `academic_records.csv` $\rightarrow$ `complete_connected.csv` | `(student_id, semester, subject_id)` | $1 : 1$ | 0 | 0 | 0 | **VALID** |
| `training_data.csv` $\rightarrow$ `predictions.csv` | `(student_id, subject_key, semester)` | $1 : 1$ | 0 | 0 | 0 | **VALID** |
| `predictions.csv` $\rightarrow$ `explanations.csv` | `(student_id, subject_key, semester)` | $1 : 11$ | 0 (sample subset) | 0 | 0 | **VALID** |

---

## 4. Academic Logic Validation (Phase 4)

1. **Component Marks Summation:**
   $$\text{grand\_total\_marks} = \text{mid\_sem} + \text{class\_test\_1} + \text{class_test\_2} + \text{assignment} + \text{other\_internal} + \text{end\_sem}$$
   - Max absolute difference across all 47,550 records: **`0.000`** (0 discrepancies).
2. **Component Max Summation:**
   $$\text{grand\_total\_max} = \text{sum of component max marks}$$
   - Max absolute difference across all 47,550 records: **`0.000`** (0 discrepancies).
3. **Grand Total Percentage:**
   $$\text{grand\_total\_percentage} = (\text{grand\_total\_marks} / \text{grand\_total\_max}) \times 100$$
   - Max absolute difference: **`0.0048%`** (due to 2-decimal place rounding).
4. **Subject Result Rule:**
   $$\text{subject\_result} = \begin{cases} \text{Pass} & \text{if } \text{grand\_total\_percentage} \ge 40.0 \\ \text{Fail} & \text{if } \text{grand\_total\_percentage} < 40.0 \end{cases}$$
   - Discrepancies across all 47,550 records: **`0`** (Pass: 43,979, Fail: 3,571).
5. **Attendance Percentage:**
   $$\text{attendance\_percentage} = (\text{classes\_attended} / \text{total\_classes}) \times 100$$
   - Discrepancies $> 0.05\%$: **`0`**.
6. **Passed Subjects Consistency:**
   - In `semester_summary_cgpa_risk.csv`, `subjects_passed` exactly equals the count of `subject_result == "Pass"` for that student in that semester: **`0 mismatches across 7,650 summaries`**.
7. **Task Checklist Completion:**
   - In `support_plan_tasks.csv`, `checklist_items_completed` exactly matches the count of `is_completed == "Yes"` in `task_checklist_progress.csv`: **`0 mismatches across 3,060 tasks`**.

---

## 5. ML Pipeline & Data Leakage Audit (Phase 5)

- **Target Leakage:** Clean. Neither `ese_percentage` nor `ese_below_40_percent` enters model input feature matrix $X$.
- **Identifier Leakage:** Clean. `student_id`, `student_name`, `subject_id`, and `subject_name` are strictly excluded from $X$.
- **Partition Leakage:** Clean. [train.py](file:///c:/Projects/student-academic-risk-early-warning-system/ml/src/train.py) and [evaluate.py](file:///c:/Projects/student-academic-risk-early-warning-system/ml/src/evaluate.py) enforce `GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)` grouped by `student_id`. Training students ($1,224$) and testing students ($306$) are 100% disjoint.
- **Preprocessor Fitting:** Clean. `ColumnTransformer` is fitted exclusively on $X_{\text{train}}$ inside the scikit-learn `Pipeline`.
- **Subject Key Consistency:** Evaluated and verified that composite `subject_key` is generated uniformly across preprocessing, training, prediction, and SHAP code.

---

## 6. Prediction & SHAP Coverage Strategy (Phase 6)

### Cohort Prediction Coverage
- Total records eligible in `subject_level_training_data.csv`: **`47,550`**
- Total predictions generated in `subject_level_predictions.csv`: **`47,550`** (100% coverage)
- Minimum risk probability: `0.0000`, Maximum risk probability: `0.9570`
- Risk level distribution:
  - **Low Risk** $(\le 0.30)$: 33,747 records ($70.97\%$)
  - **Moderate Risk** $(0.30, 0.60]$: 8,969 records ($18.86\%$)
  - **High Risk** $(> 0.60)$: 4,834 records ($10.17\%$)
- Binary class mapping: `predicted_below_40 == 1` corresponds identically to `predicted_risk_probability >= 0.50` (47,550 / 47,550 records).

### SHAP Explanation Architecture & Cost Assessment
- **PermutationExplainer Cost Analysis:**
  Generating numerical model-agnostic permutation explanations takes $\approx 0.24$ seconds per instance ($24$ seconds for 100 records). Pre-computing all 47,550 records would consume $\approx 3.2$ hours of compute time and generate $523,050$ CSV rows ($\approx 125$ MB).
- **Recommended Dual Explanation Strategy:**
  1. **Batch Cache for Priority Interventions:** Pre-calculate explanations for high-risk instances ($P > 0.60$, 4,834 records) during scheduled nightly batch runs.
  2. **On-Demand Single-Instance Explanation API:** For interactive UI exploration in the frontend/FastAPI backend, provide an on-demand endpoint `GET /api/v1/students/{student_id}/subjects/{subject_key}/explanation`. The backend loads the cached model pipeline and computes the 10 top features + residual on-the-fly in $\approx 240$ ms.
- **Mathematical Residual Closure:**
  Every explained instance provides ranks 1 to 10 plus an explicit Rank 11 residual row (`residual_other_features`). Base probability + all 11 rows reconstructs the predicted probability within $\le 7.77 \times 10^{-16} \ll 0.0001$.

---

## 7. Retrained Model Performance Metrics

Trained on 38,257 records (1,224 students) and evaluated on 9,293 held-out test records (306 students):

| Metric | Random Forest (Selected) | Logistic Regression |
|---|---|---|
| **Overall Accuracy** | **86.71%** | 78.67% |
| **Macro F1 Score** | **0.7061** | 0.6569 |
| **Below-40% Class Recall** | **60.76%** (590 / 971 detected) | 82.08% (797 / 971 detected) |
| **Below-40% Class Precision** | **40.86%** | 30.60% |
| **Below-40% Class F1** | **0.4886** | 0.4457 |
| **Missed At-Risk Cases (FN)** | **381 cases** | 174 cases |
| **False Alarms (FP)** | **854 cases** | 1,808 cases |

> [!CAUTION]
> **Synthetic Data & Target Limitations**
> The dataset is synthetic demo data. The 40% threshold is a provisional baseline target, not a verified university regulatory cutoff. The model is an early-warning statistical attribution tool, not an authoritative academic evaluator or causal diagnostic.
