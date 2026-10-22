"""
Service module for student enrolled subjects and risk predictions resolution.
"""

from typing import List, Optional
import pandas as pd

from backend.config import ACADEMIC_RECORDS_FILE, PREDICTIONS_FILE
from backend.schemas.subject import StudentSubjectResponse, RiskSummaryResponse
from backend.services.student_service import student_exists, get_student_detail

_academic_df: Optional[pd.DataFrame] = None
_predictions_df: Optional[pd.DataFrame] = None


def get_academic_df() -> pd.DataFrame:
    global _academic_df
    if _academic_df is None:
        if not ACADEMIC_RECORDS_FILE.exists():
            raise FileNotFoundError(f"Academic records dataset missing at: {ACADEMIC_RECORDS_FILE}")
        df = pd.read_csv(ACADEMIC_RECORDS_FILE)
        if "subject_key" not in df.columns:
            df["subject_key"] = df["department_code"].astype(str) + "_" + df["subject_id"].astype(str)
        _academic_df = df
    return _academic_df


def get_predictions_df() -> pd.DataFrame:
    global _predictions_df
    if _predictions_df is None:
        if not PREDICTIONS_FILE.exists():
            raise FileNotFoundError(f"Predictions dataset missing at: {PREDICTIONS_FILE}")
        df = pd.read_csv(PREDICTIONS_FILE)
        if "subject_key" not in df.columns:
            df["subject_key"] = df["department_code"].astype(str) + "_" + df["subject_id"].astype(str)
        _predictions_df = df
    return _predictions_df


def get_student_subjects(
    student_id: str,
    semester: Optional[int] = None,
) -> Optional[List[StudentSubjectResponse]]:
    """
    Retrieve enrolled subjects and associated ML risk predictions for a student.
    Returns None if student does not exist.
    """
    student = get_student_detail(student_id)
    if student is None:
        return None

    target_sem = semester if semester is not None else student.current_semester

    academic_df = get_academic_df()
    enrolled = academic_df[
        (academic_df["student_id"] == student_id) & (academic_df["semester"] == target_sem)
    ]

    if enrolled.empty:
        return []

    # Map predictions by composite key (student_id, subject_key, semester)
    predictions_df = get_predictions_df()
    student_preds = predictions_df[
        (predictions_df["student_id"] == student_id) & (predictions_df["semester"] == target_sem)
    ]
    pred_map = {
        row["subject_key"]: row
        for _, row in student_preds.iterrows()
    }

    results: List[StudentSubjectResponse] = []
    for _, row in enrolled.iterrows():
        s_key = str(row["subject_key"])
        
        # Resolve risk prediction if present (never fabricate if missing)
        risk_summary: Optional[RiskSummaryResponse] = None
        if s_key in pred_map:
            p_row = pred_map[s_key]
            risk_summary = RiskSummaryResponse(
                predicted_risk_probability=float(p_row["predicted_risk_probability"]),
                predicted_risk_level=str(p_row["predicted_risk_level"]),
                predicted_below_40=int(p_row["predicted_below_40"]),
                target_definition="Provisional ESE < 40%",
            )

        results.append(
            StudentSubjectResponse(
                subject_key=s_key,
                subject_id=str(row["subject_id"]),
                subject_name=str(row["subject_name"]),
                component=str(row.get("component", "THEORY")),
                credits=int(row.get("credits", 0)),
                attendance_percentage=float(row.get("attendance_percentage", 0.0)),
                classes_attended=int(row.get("classes_attended", 0)),
                total_classes=int(row.get("total_classes", 0)),
                risk_summary=risk_summary,
            )
        )

    return results
