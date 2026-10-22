"""
Tests for Data Integrity and Key Uniqueness across all project CSV files.
"""

from pathlib import Path
import pytest
import pandas as pd
import numpy as np

from ml.src.data_loader import (
    load_students,
    load_subject_catalog,
    load_academic_records,
    load_semester_summary,
    load_assessments,
    load_support_tasks,
    load_task_checklists,
    load_training_data,
    load_predictions,
)


def test_source_csvs_exist_and_not_empty():
    """Verify that all core source datasets exist and have data."""
    st = load_students()
    cat = load_subject_catalog()
    ac = load_academic_records()
    sem = load_semester_summary()
    assess = load_assessments()
    tasks = load_support_tasks()
    cl = load_task_checklists()

    assert len(st) == 1530
    assert len(cat) == 231
    assert len(ac) == 47550
    assert len(sem) == 7650
    assert len(assess) == 451500
    assert len(tasks) == 3060
    assert len(cl) == 13796


def test_primary_key_uniqueness():
    """Ensure candidate keys are strictly unique across all tables."""
    st = load_students()
    assert st["student_id"].is_unique, "Duplicate student_id found in students.csv!"

    cat = load_subject_catalog()
    assert not cat.duplicated(subset=["department_code", "subject_id"]).any(), (
        "Duplicate (department_code, subject_id) found in subject_catalog.csv!"
    )
    assert cat["subject_key"].is_unique, "Duplicate composite subject_key in catalog!"

    ac = load_academic_records()
    assert not ac.duplicated(subset=["student_id", "subject_key", "semester"]).any(), (
        "Duplicate student-subject-semester record in academic_records.csv!"
    )

    sem = load_semester_summary()
    assert not sem.duplicated(subset=["student_id", "semester"]).any(), (
        "Duplicate student-semester summary in semester_summary_cgpa_risk.csv!"
    )

    tasks = load_support_tasks()
    assert tasks["task_id"].is_unique, "Duplicate task_id in support_plan_tasks.csv!"

    cl = load_task_checklists()
    assert cl["checklist_item_id"].is_unique, "Duplicate checklist_item_id in task_checklist_progress.csv!"


def test_referential_integrity_and_no_orphans():
    """Verify foreign key relationships across entities."""
    st = load_students()
    ac = load_academic_records()
    cat = load_subject_catalog()
    assess = load_assessments()
    tasks = load_support_tasks()
    cl = load_task_checklists()

    valid_student_ids = set(st["student_id"])
    valid_subject_keys = set(cat["subject_key"])
    valid_task_ids = set(tasks["task_id"])

    # All students in academic_records must exist in students.csv
    assert set(ac["student_id"]).issubset(valid_student_ids)

    # All subjects in academic_records must exist in catalog
    assert set(ac["subject_key"]).issubset(valid_subject_keys)

    # All assessments must link to valid students and subjects
    assert set(assess["student_id"]).issubset(valid_student_ids)
    assert set(assess["subject_key"]).issubset(valid_subject_keys)

    # All support tasks must link to valid students
    assert set(tasks["student_id"]).issubset(valid_student_ids)

    # All checklist items must link to valid tasks
    assert set(cl["task_id"]).issubset(valid_task_ids)


def test_numeric_ranges_and_bounds():
    """Check that percentages, attendance, marks, and counts satisfy physical bounds."""
    ac = load_academic_records()
    assert (ac["grand_total_percentage"] >= 0).all() and (ac["grand_total_percentage"] <= 100).all()
    assert (ac["attendance_percentage"] >= 0).all() and (ac["attendance_percentage"] <= 100).all()
    assert (ac["classes_attended"] <= ac["total_classes"]).all()
    assert (ac["classes_attended"] >= 0).all()

    sem = load_semester_summary()
    assert (sem["semester_gpa_synthetic"] >= 0).all() and (sem["semester_gpa_synthetic"] <= 10.0).all()
    assert (sem["cumulative_cgpa_synthetic"] >= 0).all() and (sem["cumulative_cgpa_synthetic"] <= 10.0).all()
    assert (sem["semester_attendance_percentage"] >= 0).all() and (sem["semester_attendance_percentage"] <= 100).all()
    assert (sem["subjects_passed"] <= sem["subjects_total"]).all()


def test_collision_resolution_it301l():
    """Verify that IT301L is preserved as two distinct courses via subject_key."""
    cat = load_subject_catalog()
    it301 = cat[cat["subject_id"] == "IT301L"]
    assert len(it301) == 2, "IT301L must appear exactly twice (CS and IT departments)!"
    assert set(it301["subject_key"]) == {"CS_IT301L", "IT_IT301L"}

    ac = load_academic_records()
    ac_it301 = ac[ac["subject_id"] == "IT301L"][["department_code", "subject_key", "subject_name"]].drop_duplicates()
    assert len(ac_it301) == 2
    cs_name = ac_it301[ac_it301["department_code"] == "CS"]["subject_name"].iloc[0]
    it_name = ac_it301[ac_it301["department_code"] == "IT"]["subject_name"].iloc[0]
    assert cs_name == "Database Systems"
    assert it_name == "Operating Systems"
