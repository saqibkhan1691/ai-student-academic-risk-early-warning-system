"""
FastAPI Backend Application for the AI Student Academic Risk Early Warning System.

Security Note:
Authentication and Authorization must be implemented before exposing student
data endpoints to public or untrusted networks beyond local development.
All student records in this batch are synthetic demo records; risk targets are provisional.
"""

from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from backend.config import (
    MODEL_PATH,
    STUDENTS_FILE,
    settings,
)
from backend.schemas.health import HealthResponse
from backend.schemas.student import StudentDetailResponse
from backend.schemas.subject import StudentSubjectResponse
from backend.schemas.explanation import ExplanationResponse
from backend.services.student_service import get_student_detail, student_exists
from backend.services.subject_service import get_student_subjects
from backend.services.explanation_service import (
    get_explanation,
    StudentNotFoundError,
    SubjectNotEnrolledError,
    ExplanationDataError,
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Early warning risk intelligence API for academic institutions. "
        "Predicts provisional End-Semester Exam (ESE) below-40% probability "
        "and provides mathematically validated SHAP feature attributions."
    ),
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Service Health Check",
)
@app.get(
    f"{settings.API_V1_STR}/health",
    response_model=HealthResponse,
    tags=["System"],
    include_in_schema=False,
)
def health_check() -> HealthResponse:
    """Return operational status and provenance disclaimers."""
    dataset_status = "synthetic_demo_loaded" if STUDENTS_FILE.exists() else "dataset_missing"
    model_status = "available" if MODEL_PATH.exists() else "model_missing"

    return HealthResponse(
        status="healthy" if dataset_status == "synthetic_demo_loaded" else "degraded",
        version=settings.VERSION,
        dataset_status=dataset_status,
        model_status=model_status,
        disclaimer=(
            "All academic records are synthetic demo data. "
            "Predictions and risk thresholds are experimental."
        ),
    )


@app.get(
    "/students/{student_id}",
    response_model=StudentDetailResponse,
    tags=["Students"],
    summary="Get Student Profile & Academic Summary",
)
@app.get(
    f"{settings.API_V1_STR}/students/{{student_id}}",
    response_model=StudentDetailResponse,
    tags=["Students"],
    include_in_schema=False,
)
def get_student(student_id: str) -> StudentDetailResponse:
    """
    Retrieve student identity, department, section, and latest semester academic summary.
    Returns 404 if student_id does not exist.
    """
    student = get_student_detail(student_id)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID '{student_id}' not found.",
        )
    return student


@app.get(
    "/students/{student_id}/subjects",
    response_model=List[StudentSubjectResponse],
    tags=["Subjects"],
    summary="Get Enrolled Subjects and Predictions",
)
@app.get(
    f"{settings.API_V1_STR}/students/{{student_id}}/subjects",
    response_model=List[StudentSubjectResponse],
    tags=["Subjects"],
    include_in_schema=False,
)
def get_subjects(
    student_id: str,
    semester: Optional[int] = Query(
        None,
        ge=1,
        le=5,
        description="Filter subjects by semester. Defaults to student's current active semester.",
    ),
) -> List[StudentSubjectResponse]:
    """
    Retrieve subjects and ML risk predictions for a student.
    Returns 404 if student_id does not exist.
    """
    subjects = get_student_subjects(student_id=student_id, semester=semester)
    if subjects is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID '{student_id}' not found.",
        )
    return subjects


@app.get(
    f"{settings.API_V1_STR}/students/{{student_id}}/semesters/{{semester}}/subjects",
    response_model=List[StudentSubjectResponse],
    tags=["Subjects"],
    include_in_schema=False,
)
def get_subjects_by_semester(
    student_id: str,
    semester: int,
) -> List[StudentSubjectResponse]:
    """Path-based alias for retrieving subjects by semester."""
    return get_subjects(student_id=student_id, semester=semester)


@app.get(
    "/students/{student_id}/subjects/{subject_key}/explanation",
    response_model=ExplanationResponse,
    tags=["Explanations"],
    summary="Get SHAP Risk Explanation for a Subject",
)
@app.get(
    f"{settings.API_V1_STR}/students/{{student_id}}/subjects/{{subject_key}}/explanation",
    response_model=ExplanationResponse,
    tags=["Explanations"],
    include_in_schema=False,
)
def get_subject_explanation(
    student_id: str,
    subject_key: str,
    semester: Optional[int] = Query(
        None,
        ge=1,
        le=5,
        description="Semester of enrollment. If omitted, resolved automatically.",
    ),
) -> ExplanationResponse:
    """
    Retrieve feature attributions explaining the student's risk probability in a course.
    Uses pre-computed cache when available or computes on demand.
    Returns ranks 1-10 plus an explicit Rank 11 residual closing additivity within 0.0001.
    """
    try:
        explanation = get_explanation(
            student_id=student_id,
            subject_key=subject_key,
            semester=semester,
        )
        return explanation
    except StudentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except SubjectNotEnrolledError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ExplanationDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error computing explanation: {str(exc)}",
        ) from exc
