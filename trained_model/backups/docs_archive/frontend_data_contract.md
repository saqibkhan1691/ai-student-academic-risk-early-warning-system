# Frontend-Integration Logical Data Contract
**Project:** AI Student Academic Risk Early Warning System  
**Document Purpose:** API & UI Integration Contract for future FastAPI implementation  
**Status:** Approved for Integration Planning (Do NOT implement FastAPI backend in this task)  
**Date:** October 2026  

---

## 1. Architectural Principles & Separation of Concerns

To avoid coupling subjective interventions with machine learning predictions, the frontend integration must observe three independent entity domains:
1. **Model Risk Intelligence:** Purely objective mathematical probabilities ($P(\text{ESE} < 40\%)$), triage categories (`Low`, `Moderate`, `High`), and SHAP feature contributions.
2. **Mentor & Faculty Assessment:** Human observational notes, qualitative risk judgments, and revision flags entered manually by teachers.
3. **Remedial Task Progress:** Concrete actionable support plans, practice sheets, and milestone checklists tracked independently.

> [!IMPORTANT]
> **Field Availability & Synthetic Markers:**
> - The dataset contains simulated academic records. Any fields marked `_synthetic` (e.g. `semester_gpa_synthetic`) represent demonstration values rather than certified university transcripts.
> - Fields not present in the current dataset (e.g. real-time biometric attendance, assignment deadlines, mentor qualitative text notes) are marked **`UNAVAILABLE IN V1`** and must not be mocked or fabricated in the API.

---

## 2. Entity Contracts & Proposed JSON Schemas

### Contract 1: Student Identity & Academic Summary
- **Endpoint Pattern:** `GET /api/v1/students/{student_id}`
- **Logical Key:** `student_id` (e.g. `"2428CS1020"`)
- **JSON Schema:**
```json
{
  "student_id": "2428CS1020",
  "student_name": "Aarav Sharma",
  "department_code": "CS",
  "department_name": "Computer Science & Engineering",
  "section": "A",
  "program": "B.Tech",
  "batch_year": 2028,
  "current_semester": 5,
  "academic_summary": {
    "cumulative_cgpa": 7.66,
    "semester_attendance_percentage": 82.50,
    "total_subjects_enrolled": 12,
    "total_subjects_passed": 12,
    "pending_assignments_total": 1,
    "data_status": "synthetic_demo"
  }
}
```

### Contract 2: Student Subject List
- **Endpoint Pattern:** `GET /api/v1/students/{student_id}/semesters/{semester}/subjects`
- **Logical Key:** `(student_id, semester, subject_key)`
- **JSON Schema:**
```json
[
  {
    "subject_key": "CS_MA101L",
    "subject_id": "MA101L",
    "subject_name": "Calculus for Engineers",
    "component": "THEORY",
    "credits": 4,
    "attendance_percentage": 78.26,
    "classes_attended": 36,
    "total_classes": 46,
    "risk_summary": {
      "predicted_risk_probability": 0.5002,
      "predicted_risk_level": "Moderate",
      "predicted_below_40": 1,
      "target_definition": "Provisional ESE < 40%"
    }
  }
]
```

### Contract 3: Subject Assessment Details
- **Endpoint Pattern:** `GET /api/v1/students/{student_id}/subjects/{subject_key}/assessments`
- **Logical Key:** `(student_id, subject_key, assessment_type, assessment_number)`
- **JSON Schema:**
```json
{
  "student_id": "2428CS2071",
  "subject_key": "CS_MA101L",
  "subject_name": "Calculus for Engineers",
  "semester": 1,
  "assessments": [
    {
      "assessment_type": "Mid Semester",
      "assessment_number": 1,
      "marks_obtained": 14.0,
      "max_marks": 30.0,
      "percentage": 46.67,
      "submitted": null
    },
    {
      "assessment_type": "Class Test",
      "assessment_number": 1,
      "marks_obtained": 6.0,
      "max_marks": 10.0,
      "percentage": 60.00,
      "submitted": null
    },
    {
      "assessment_type": "Assignment",
      "assessment_number": 1,
      "marks_obtained": 4.0,
      "max_marks": 5.0,
      "percentage": 80.00,
      "submitted": true
    }
  ],
  "summary": {
    "assignment_count": 4,
    "assignments_submitted": 4,
    "assignment_completion_percentage": 100.0,
    "deadline_dates": "UNAVAILABLE IN V1"
  }
}
```

### Contract 4: Subject-Level Prediction & Risk Probability
- **Endpoint Pattern:** `GET /api/v1/students/{student_id}/subjects/{subject_key}/prediction`
- **Logical Key:** `(student_id, subject_key, semester)`
- **JSON Schema:**
```json
{
  "student_id": "2428CS2071",
  "subject_key": "CS_MA101L",
  "subject_name": "Calculus for Engineers",
  "semester": 1,
  "model_version": "RandomForest_v2.0",
  "prediction": {
    "predicted_risk_probability": 0.5002,
    "predicted_risk_level": "Moderate",
    "predicted_below_40": 1,
    "decision_threshold": 0.50,
    "risk_level_cutoffs": {
      "low": [0.0, 0.30],
      "moderate": [0.30, 0.60],
      "high": [0.60, 1.0]
    },
    "disclaimer": "Model probabilities are statistical estimates from pre-ESE assessment patterns on synthetic data. Not validated institutional pass/fail judgments."
  }
}
```

### Contract 5: SHAP Explanation & Feature Contributions
- **Endpoint Pattern:** `GET /api/v1/students/{student_id}/subjects/{subject_key}/explanation`
- **Logical Key:** `(student_id, subject_key, semester, feature_rank)`
- **JSON Schema:**
```json
{
  "student_id": "2428CS2071",
  "subject_key": "CS_MA101L",
  "subject_name": "Calculus for Engineers",
  "semester": 1,
  "base_probability": 0.2262,
  "predicted_risk_probability": 0.5002,
  "reconstructed_probability": 0.5002,
  "reconstruction_error": 7.77e-16,
  "is_additivity_closed": true,
  "features": [
    {
      "rank": 1,
      "feature_name": "numeric__other_internal_1",
      "display_label": "Other Internal 1",
      "original_value": "20.00%",
      "transformed_value": -1.8745,
      "shap_value": 0.1192,
      "impact_direction": "increases predicted below-40% probability",
      "is_aggregate_residual": false
    },
    {
      "rank": 2,
      "feature_name": "numeric__class_test_2",
      "display_label": "Class Test 2",
      "original_value": "50.00%",
      "transformed_value": -0.6861,
      "shap_value": 0.0479,
      "impact_direction": "increases predicted below-40% probability",
      "is_aggregate_residual": false
    },
    {
      "rank": 11,
      "feature_name": "residual_other_features",
      "display_label": "Other Omitted Factors",
      "original_value": "Aggregate of remaining omitted features",
      "transformed_value": null,
      "shap_value": 0.0041,
      "impact_direction": "increases predicted below-40% probability (aggregate of remaining features)",
      "is_aggregate_residual": true
    }
  ]
}
```

### Contract 6: Mentor Feedback & Qualitative Assessment (Entity Separation)
- **Endpoint Pattern:** `GET /api/v1/students/{student_id}/mentor-notes`
- **Logical Key:** `(student_id, mentor_id, note_id)`
- **JSON Schema:**
```json
{
  "student_id": "2428CS2071",
  "mentor_records": [
    {
      "note_id": "NOTE_001",
      "mentor_role": "Faculty Advisor",
      "academic_term": "Semester 5",
      "manual_risk_assessment": "Needs Attention",
      "mentor_comments": "UNAVAILABLE IN V1 (To be integrated during FastAPI CRUD phase)",
      "review_status": "Approved",
      "created_at": "2026-10-18T10:00:00Z"
    }
  ]
}
```

### Contract 7: Support Tasks & Milestone Checklist Progress
- **Endpoint Pattern:** `GET /api/v1/students/{student_id}/support-tasks`
- **Logical Key:** `task_id` (e.g. `"TASK000036"`)
- **JSON Schema:**
```json
[
  {
    "task_id": "TASK000036",
    "student_id": "2428CS1020",
    "subject_id": "CS310L",
    "subject_name": "Theory of Computation",
    "task_description": "Complete DFA practice problem set 2",
    "assigned_by_role": "Subject Teacher",
    "task_status": "In Progress",
    "mentor_review_status": "Needs Revision",
    "completion_percentage": 40.0,
    "checklist_items_total": 5,
    "checklist_items_completed": 2,
    "assignment_sheet_assigned": true,
    "assignment_sheet_name": "CS310L_Remedial_Sheet_2.pdf",
    "checklists": [
      {
        "checklist_item_id": "TASK000036_ITEM1",
        "description": "Review textbook chapter 3",
        "is_completed": true,
        "completed_on": "2026-10-18"
      },
      {
        "checklist_item_id": "TASK000036_ITEM3",
        "description": "Submit question 4 & 5 to tutor",
        "is_completed": false,
        "completed_on": null
      }
    ]
  }
]
```

---

## 3. UI Display Guidelines for Frontend Engineers

1. **Never Display $z$-Scores as Student Marks:**
   The UI must render `feature_value_original` (e.g. `"20.00%"`, `"46.67%"`, or `"Calculus for Engineers"`), never `feature_value_transformed` (`-1.8745`). Transformed values are preserved solely for debugging or technical inspection tooltips.
2. **Handle the Aggregate Residual Row:**
   The frontend waterfall / bar chart should render Rank 11 (`residual_other_features`) in a muted/distinct color (e.g. neutral gray) labeled as *"Other Course & Term Factors"*, distinctly separating it from specific course assessments.
3. **Display Disclaimers in Risk Card:**
   The model risk card must include a standard disclosure:
   > *"Predicted risk is based on internal continuous assessments. Final End-Semester Exam outcomes depend on full institutional regulations and student performance."*
