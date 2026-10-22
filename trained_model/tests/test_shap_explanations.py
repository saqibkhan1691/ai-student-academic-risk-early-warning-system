"""
Tests for SHAP explanations interpretability, signs, and exact additivity closure.
"""

import pytest
import pandas as pd
import numpy as np

from ml.src.data_loader import (
    load_shap_explanations,
    load_predictions,
)


def test_shap_explanation_structure_and_records():
    """Verify that SHAP explanation CSV has 100 explained records with 11 rows each (10 features + 1 residual)."""
    df = load_shap_explanations()
    assert len(df) == 1100

    groups = df.groupby(["student_id", "subject_key", "semester"])
    assert len(groups) == 100

    for _, group in groups:
        ranks = sorted(group["feature_rank"].tolist())
        assert ranks == list(range(1, 12)), "Each record must have feature ranks 1 through 11!"

        # Rank 11 must be the residual row
        residual = group[group["feature_rank"] == 11].iloc[0]
        assert residual["feature_name"] == "residual_other_features"
        assert residual["feature_value_original"] == "Aggregate of remaining omitted features"
        assert pd.isna(residual["feature_value_transformed"])


def test_shap_impact_direction_and_sign():
    """Verify that shap_value signs match impact_direction text."""
    df = load_shap_explanations()

    pos_rows = df[df["shap_value"] > 0]
    for _, row in pos_rows.iterrows():
        assert "increases" in row["impact_direction"]

    neg_rows = df[df["shap_value"] < 0]
    for _, row in neg_rows.iterrows():
        assert "decreases" in row["impact_direction"]


def test_shap_additivity_and_residual_closure():
    """Verify base_probability + sum(shap_value) reconstructs predicted_risk_probability within 0.0001."""
    df = load_shap_explanations()
    groups = df.groupby(["student_id", "subject_key", "semester"])

    max_err = 0.0
    for _, group in groups:
        base_p = group["base_probability"].iloc[0]
        pred_p = group["predicted_risk_probability"].iloc[0]
        recon_p = group["reconstructed_probability"].iloc[0]
        shap_sum = group["shap_value"].sum()

        calculated_pred = base_p + shap_sum
        err = abs(calculated_pred - pred_p)
        if err > max_err:
            max_err = err

    assert max_err <= 1e-4, f"SHAP additivity reconstruction error {max_err} exceeds 0.0001 tolerance!"
    assert max_err <= 1e-14, f"Expected machine precision closure, got {max_err}"


def test_original_values_are_not_z_scores():
    """Verify that feature_value_original contains percentages for assessment features, not standardized z-scores."""
    df = load_shap_explanations()

    assessment_features = df[
        df["feature_name"].str.startswith("numeric__")
        & ~df["feature_name"].str.contains("semester")
        & ~df["feature_name"].str.contains("count")
        & ~df["feature_name"].str.contains("submitted")
    ]

    for _, row in assessment_features.head(50).iterrows():
        orig_val = str(row["feature_value_original"])
        # Must end with '%' or be 'Missing (imputed with median)'
        assert orig_val.endswith("%") or "Missing" in orig_val, (
            f"Original feature value '{orig_val}' is not formatted as percentage or missing indicator!"
        )
