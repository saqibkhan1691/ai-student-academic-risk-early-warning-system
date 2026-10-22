"""
Service module for student profile and academic summary retrieval.
"""

from typing import Optional
import pandas as pd

from backend.config import STUDENTS_FILE, SEMESTER_SUMMARY_FILE
from backend.schemas.student import StudentDetailResponse, AcademicSummaryResponse

_students_df: Optional[pd.DataFrame] = None
_summary_df: Optional[pd.DataFrame] = None


def get_students_df() -> pd.DataFrame:
    global _students_df
    if _students_df is None:
        if not STUDENTS_FILE.exists():
            raise FileNotFoundError(f"Students dataset missing at: {STUDENTS_FILE}")
        _students_df = pd.read_csv(STUDENTS_FILE)
    return _students_df


def get_summary_df() -> pd.DataFrame:
    global _summary_df
    if _summary_df is None:
        if not SEMESTER_SUMMARY_FILE.exists():
            raise FileNotFoundError(f"Semester summary dataset missing at: {SEMESTER_SUMMARY_FILE}")
        _summary_df = pd.read_csv(SEMESTER_SUMMARY_FILE)
    return _summary_df


def student_exists(student_id: str) -> bool:
    """Check if student ID exists in the master table."""
    df = get_students_df()
    return bool((df["student_id"] == student_id).any())


def get_student_detail(student_id: str) -> Optional[StudentDetailResponse]:
    """
    Retrieve student identity and latest academic summary.
    Returns None if student_id does not exist.
    """
    students = get_students_df()
    matches = students[students["student_id"] == student_id]
    if matches.empty:
        return None

    row = matches.iloc[0]
    curr_sem = int(row["current_semester"])

    # Retrieve semester summary for current semester (or latest semester if multiple)
    summary_df = get_summary_df()
    sem_matches = summary_df[
        (summary_df["student_id"] == student_id) & (summary_df["semester"] == curr_sem)
    ]

    academic_summary: Optional[AcademicSummaryResponse] = None
    if not sem_matches.empty:
        s_row = sem_matches.iloc[0]
        academic_summary = AcademicSummaryResponse(
            cumulative_cgpa=float(s_row["cumulative_cgpa_synthetic"]),
            semester_attendance_percentage=float(s_row["semester_attendance_percentage"]),
            total_subjects_enrolled=int(s_row["subjects_total"]),
            total_subjects_passed=int(s_row["subjects_passed"]),
            pending_assignments_total=int(s_row["pending_assignments_total"]),
            data_status="synthetic_demo",
        )

    return StudentDetailResponse(
        student_id=str(row["student_id"]),
        student_name=str(row["student_name"]),
        department_code=str(row["department_code"]),
        department_name=str(row["department_name"]),
        section=str(row["section"]),
        program=str(row.get("program", "B.Tech")),
        batch_year=int(row.get("batch_year", 2028)),
        current_semester=curr_sem,
        academic_summary=academic_summary,
    )
