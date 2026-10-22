from typing import Optional
from pydantic import BaseModel, Field


class AcademicSummaryResponse(BaseModel):
    cumulative_cgpa: float = Field(..., description="Simulated Cumulative Grade Point Average")
    semester_attendance_percentage: float = Field(..., description="Average attendance percentage for the semester")
    total_subjects_enrolled: int = Field(..., description="Total subjects enrolled in the semester")
    total_subjects_passed: int = Field(..., description="Subjects with passing result")
    pending_assignments_total: int = Field(..., description="Total incomplete homework assignments")
    data_status: str = Field("synthetic_demo", description="Data provenance marker")


class StudentDetailResponse(BaseModel):
    student_id: str = Field(..., description="Unique student identifier (e.g. 2428CS1020)")
    student_name: str = Field(..., description="Full student name (synthetic demo name)")
    department_code: str = Field(..., description="Department abbreviation (e.g. CS, IT)")
    department_name: str = Field(..., description="Official department name")
    section: str = Field(..., description="Cohort section letter (e.g. A, B)")
    program: str = Field("B.Tech", description="Academic degree program")
    batch_year: int = Field(2028, description="Graduation batch year")
    current_semester: int = Field(..., description="Current active semester")
    academic_summary: Optional[AcademicSummaryResponse] = Field(
        None, description="Academic summary metrics for the current or latest semester"
    )
