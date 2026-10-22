from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., description="Service status", json_schema_extra={"example": "healthy"})
    version: str = Field(..., description="API version", json_schema_extra={"example": "1.0.0"})
    dataset_status: str = Field(..., description="Status of synthetic dataset", json_schema_extra={"example": "synthetic_demo_loaded"})
    model_status: str = Field(..., description="Status of trained model artifact", json_schema_extra={"example": "available"})
    disclaimer: str = Field(
        ...,
        description="Dataset and target disclaimer",
        json_schema_extra={"example": "All academic records are synthetic demo data. Predictions and risk thresholds are experimental."},
    )
