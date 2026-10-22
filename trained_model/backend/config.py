"""
Configuration settings for the AI Student Academic Risk Early Warning System FastAPI Backend.

Note on Security & Data Protection:
Authentication and Authorization (e.g. OAuth2/JWT or institutional SSO) are REQUIRED
before exposing student data endpoints beyond local development environments.
All student records in this batch are synthetic demo records; ESE risk targets are provisional.
"""

import os
from pathlib import Path
from typing import List

# Project root determined dynamically (avoids hardcoded machine paths)
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

# Dataset paths
# Raw source CSVs are centralized under data/raw/
# Derived training dataset is under data/processed/
DATA_DIR = PROJECT_ROOT / "data" / "raw"
ML_DATA_DIR = PROJECT_ROOT / "data" / "processed"
ML_REPORTS_DIR = PROJECT_ROOT / "ml" / "reports"
MODEL_PATH = PROJECT_ROOT / "ml" / "models" / "academic_risk_model.joblib"

# CSV file paths
STUDENTS_FILE = DATA_DIR / "students.csv"
SUBJECT_CATALOG_FILE = DATA_DIR / "subject_catalog.csv"
ACADEMIC_RECORDS_FILE = DATA_DIR / "academic_records.csv"
SEMESTER_SUMMARY_FILE = DATA_DIR / "semester_summary_cgpa_risk.csv"
ASSESSMENT_DETAILS_FILE = DATA_DIR / "assessment_details.csv"
SUPPORT_PLAN_TASKS_FILE = DATA_DIR / "support_plan_tasks.csv"
TASK_CHECKLIST_FILE = DATA_DIR / "task_checklist_progress.csv"

# Model and report file paths
TRAINING_DATA_FILE = ML_DATA_DIR / "subject_level_training_data.csv"
PREDICTIONS_FILE = ML_REPORTS_DIR / "subject_level_predictions.csv"
SHAP_EXPLANATIONS_FILE = ML_REPORTS_DIR / "individual_shap_explanations.csv"


class Settings:
    PROJECT_NAME: str = "AI Student Academic Risk Early Warning System API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # CORS Origins (configured via environment variable)
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173,http://localhost:8443,http://127.0.0.1:8443"
        ).split(",")
        if origin.strip()
    ]
    
    # Risk Threshold Definitions (Provisional)
    DECISION_THRESHOLD: float = 0.50
    RISK_LEVEL_LOW_MAX: float = 0.30
    RISK_LEVEL_MODERATE_MAX: float = 0.60
    
    # SHAP explainer configuration
    SHAP_BACKGROUND_SIZE: int = 20
    SHAP_TOP_FEATURES: int = 10
    SHAP_RANDOM_STATE: int = 42


settings = Settings()
