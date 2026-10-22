"""
Tests for academic calculations and grading consistency.
"""

import pytest
import pandas as pd
import numpy as np

from ml.src.data_loader import (
    load_academic_records,
    load_semester_summary,
    load_support_tasks,
    load_task_checklists,
)


def test_grand_total_marks_aggregation():
    """Verify that grand_total_marks equals the exact sum of all assessment components."""
    ac = load_academic_records()
    sum_marks = (
        ac["mid_sem_marks"]
        + ac["class_test_1_marks"]
        + ac["class_test_2_marks"]
        + ac["assignment_marks"]
        + ac["other_internal_marks"]
        + ac["end_sem_marks"]
    )
    diff = (ac["grand_total_marks"] - sum_marks).abs()
    assert (diff < 1e-4).all(), f"Found {np.sum(diff >= 1e-4)} discrepancies in grand_total_marks!"


def test_grand_total_max_aggregation():
    """Verify that grand_total_max equals the sum of component max marks."""
    ac = load_academic_records()
    sum_max = (
        ac["mid_sem_max"]
        + ac["class_test_1_max"]
        + ac["class_test_2_max"]
        + ac["assignment_max"]
        + ac["other_internal_max"]
        + ac["end_sem_max"]
    )
    diff = (ac["grand_total_max"] - sum_max).abs()
    assert (diff < 1e-4).all(), f"Found {np.sum(diff >= 1e-4)} discrepancies in grand_total_max!"


def test_subject_result_pass_fail_rule():
    """Verify provisional pass/fail rule: grand_total_percentage >= 40 is Pass, else Fail."""
    ac = load_academic_records()
    expected = np.where(ac["grand_total_percentage"] >= 40.0, "Pass", "Fail")
    mismatches = (ac["subject_result"] != expected).sum()
    assert mismatches == 0, f"Found {mismatches} mismatches in subject_result rule!"


def test_semester_subjects_passed_consistency():
    """Verify that subjects_passed in semester summary equals actual count of passed subjects in academic records."""
    ac = load_academic_records()
    sem = load_semester_summary()

    passed_counts = (
        ac[ac["subject_result"] == "Pass"]
        .groupby(["student_id", "semester"])["subject_id"]
        .count()
        .reset_index(name="actual_pass_count")
    )
    merged = sem.merge(passed_counts, on=["student_id", "semester"], how="left")
    merged["actual_pass_count"] = merged["actual_pass_count"].fillna(0)

    mismatches = (merged["subjects_passed"] != merged["actual_pass_count"]).sum()
    assert mismatches == 0, f"Found {mismatches} mismatches between semester summary and passed count!"


def test_support_task_completion_percentage():
    """Verify that task checklist completion percentage matches items completed / total items * 100."""
    tasks = load_support_tasks()
    cl = load_task_checklists()

    # Calculate actual completed from checklist Yes/No
    cl_completed = (
        cl.groupby("task_id")["is_completed"]
        .apply(lambda s: (s == "Yes").sum())
        .reset_index(name="calc_completed")
    )
    cl_total = cl.groupby("task_id")["checklist_item_id"].count().reset_index(name="calc_total")

    merged = tasks.merge(cl_completed, on="task_id").merge(cl_total, on="task_id")

    assert (merged["checklist_items_total"] == merged["calc_total"]).all()
    assert (merged["checklist_items_completed"] == merged["calc_completed"]).all()

    expected_pct = (merged["checklist_items_completed"] / merged["checklist_items_total"]) * 100
    diff_pct = (merged["completion_percentage"] - expected_pct).abs()
    assert (diff_pct < 0.1).all()
