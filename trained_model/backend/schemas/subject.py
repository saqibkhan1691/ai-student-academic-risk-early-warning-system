from typing import Optional
from pydantic import BaseModel, Field


class RiskSummaryResponse(BaseModel):
    predicted_risk_probability: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Model estimated probability of scoring below 40% in ESE",
    )
    predicted_risk_level: str = Field(
        ...,
        description="Triage risk category (Low, Moderate, High)",
    )
    predicted_below_40: int = Field(
        ...,
        description="Binary classification indicator (1 if probability >= 0.50 else 0)",
    )
    target_definition: str = Field(
        "Provisional ESE < 40%",
        description="Target definition context",
    )


class StudentSubjectResponse(BaseModel):
    subject_key: str = Field(..., description="Collision-free composite subject identifier (e.g. CS_IT301L)")
    subject_id: str = Field(..., description="Catalog subject code (e.g. IT301L)")
    subject_name: str = Field(..., description="Display title of the course")
    component: str = Field(..., description="Course component (THEORY, PRACTICAL, etc.)")
    credits: int = Field(..., description="Credit units assigned to course")
    attendance_percentage: float = Field(..., description="Subject-level attendance rate")
    classes_attended: int = Field(..., description="Number of classes attended")
    total_classes: int = Field(..., description="Total scheduled classes")
    risk_summary: Optional[RiskSummaryResponse] = Field(
        None, description="Pre-computed or real-time ML risk predictions"
    )
