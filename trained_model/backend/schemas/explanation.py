from typing import List, Optional
from pydantic import BaseModel, Field


class FeatureContribution(BaseModel):
    rank: int = Field(..., description="Importance rank (1 to 10 for top features, 11 for residual)")
    feature_name: str = Field(..., description="Internal pipeline feature name or residual identifier")
    display_label: str = Field(..., description="Human-readable feature name for UI rendering")
    original_value: str = Field(..., description="Original assessment percentage or category text")
    transformed_value: Optional[float] = Field(
        None, description="Preprocessed z-score or binary indicator (null for residual)"
    )
    shap_value: float = Field(..., description="Signed mathematical contribution to risk probability")
    impact_direction: str = Field(..., description="Plain-language direction of impact")
    is_aggregate_residual: bool = Field(
        False, description="True if row represents the aggregate of omitted features"
    )


class ExplanationResponse(BaseModel):
    student_id: str = Field(..., description="Student identifier")
    subject_key: str = Field(..., description="Composite subject identifier")
    subject_name: str = Field(..., description="Display title of the subject")
    semester: int = Field(..., description="Semester of course enrollment")
    base_probability: float = Field(..., description="Expected baseline probability across background cohort")
    predicted_risk_probability: float = Field(..., description="Target model prediction being explained")
    reconstructed_probability: float = Field(
        ..., description="Reconstructed probability: base_prob + sum(shap_values)"
    )
    reconstruction_error: float = Field(
        ..., description="Absolute difference between predicted and reconstructed probabilities"
    )
    is_additivity_closed: bool = Field(
        True, description="True if base_probability + sum(shap_values) reconstructs prediction within 0.0001"
    )
    features: List[FeatureContribution] = Field(
        ..., description="List of top feature attributions followed by aggregate residual"
    )
