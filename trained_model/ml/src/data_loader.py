"""
Data Loader Module for the AI Student Academic Risk Early Warning System.

Provides consistent, validated loading functions for source datasets,
derived training datasets, and prediction/explanation artifacts.
Ensures stable composite subject keys (department_code + '_' + subject_id)
are applied uniformly across training, inference, and analysis.
"""

from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd

# ROOT resolves to trained_model/ (ml/src -> ml -> trained_model)
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "raw"
ML_DATA_DIR = ROOT / "data" / "processed"
ML_REPORTS_DIR = ROOT / "ml" / "reports"

TARGET = "ese_below_40_percent"
GROUP = "student_id"

# Standard columns to exclude from model input features X
EXCLUDED_MODEL_COLUMNS = [
    TARGET,
    GROUP,
    "student_name",
    "ese_percentage",
    "subject_id",
    "subject_name",
]


def get_subject_key(department_code: pd.Series, subject_id: pd.Series) -> pd.Series:
    """Generate a collision-free composite subject key."""
    return department_code.astype(str) + "_" + subject_id.astype(str)


def load_students(path: Optional[Path] = None) -> pd.DataFrame:
    """Load students master table."""
    file_path = path or (DATA_DIR / "students.csv")
    df = pd.read_csv(file_path)
    return df


def load_subject_catalog(path: Optional[Path] = None) -> pd.DataFrame:
    """Load subject catalog with composite subject_key."""
    file_path = path or (DATA_DIR / "subject_catalog.csv")
    df = pd.read_csv(file_path)
    if "subject_key" not in df.columns:
        df["subject_key"] = get_subject_key(df["department_code"], df["subject_id"])
    return df


def load_academic_records(path: Optional[Path] = None) -> pd.DataFrame:
    """Load subject-level academic history records with composite subject_key."""
    file_path = path or (DATA_DIR / "academic_records.csv")
    df = pd.read_csv(file_path)
    if "subject_key" not in df.columns:
        df["subject_key"] = get_subject_key(df["department_code"], df["subject_id"])
    return df


def load_semester_summary(path: Optional[Path] = None) -> pd.DataFrame:
    """Load student semester-level performance summaries."""
    file_path = path or (DATA_DIR / "semester_summary_cgpa_risk.csv")
    df = pd.read_csv(file_path)
    return df


def load_assessments(path: Optional[Path] = None) -> pd.DataFrame:
    """Load granular pre-ESE and ESE assessment logs."""
    file_path = path or (DATA_DIR / "assessment_details.csv")
    df = pd.read_csv(file_path)
    if "subject_key" not in df.columns:
        df["subject_key"] = get_subject_key(df["department_code"], df["subject_id"])
    return df


def load_support_tasks(path: Optional[Path] = None) -> pd.DataFrame:
    """Load teacher/mentor support intervention tasks."""
    file_path = path or (DATA_DIR / "support_plan_tasks.csv")
    df = pd.read_csv(file_path)
    if "subject_key" not in df.columns:
        df["subject_key"] = get_subject_key(df["department_code"], df["subject_id"])
    return df


def load_task_checklists(path: Optional[Path] = None) -> pd.DataFrame:
    """Load milestone checklist items for support tasks."""
    file_path = path or (DATA_DIR / "task_checklist_progress.csv")
    df = pd.read_csv(file_path)
    return df


def load_training_data(path: Optional[Path] = None) -> pd.DataFrame:
    """Load preprocessed subject-level training data."""
    file_path = path or (ML_DATA_DIR / "subject_level_training_data.csv")
    df = pd.read_csv(file_path)
    if "subject_key" not in df.columns:
        df["subject_key"] = get_subject_key(df["department_code"], df["subject_id"])
    return df


def load_predictions(path: Optional[Path] = None) -> pd.DataFrame:
    """Load model predictions and assigned risk tiers."""
    file_path = path or (ML_REPORTS_DIR / "subject_level_predictions.csv")
    df = pd.read_csv(file_path)
    if "subject_key" not in df.columns:
        df["subject_key"] = get_subject_key(df["department_code"], df["subject_id"])
    return df


def load_shap_explanations(path: Optional[Path] = None) -> pd.DataFrame:
    """Load top-10 SHAP feature contributions plus residual closures."""
    file_path = path or (ML_REPORTS_DIR / "individual_shap_explanations.csv")
    df = pd.read_csv(file_path)
    return df


def prepare_features_and_target(
    df: pd.DataFrame,
    excluded_columns: Optional[List[str]] = None,
) -> Tuple[pd.DataFrame, Optional[pd.Series], pd.Series]:
    """
    Split dataset into feature matrix X, provisional target y, and grouping key groups.
    Ensures that student identifiers, display names, and target outcome fields
    are strictly excluded from predictive features.
    """
    excluded = excluded_columns or EXCLUDED_MODEL_COLUMNS
    X = df.drop(columns=[c for c in excluded if c in df.columns])
    y = df[TARGET] if TARGET in df.columns else None
    groups = df[GROUP] if GROUP in df.columns else pd.Series(index=df.index, dtype=str)
    return X, y, groups
