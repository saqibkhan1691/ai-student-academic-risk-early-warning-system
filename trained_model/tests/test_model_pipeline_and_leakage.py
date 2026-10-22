"""
Tests for ML pipeline schema consistency, leakage prevention, and prediction validity.
"""

from pathlib import Path
import joblib
import pytest
import pandas as pd
import numpy as np
from sklearn.model_selection import GroupShuffleSplit

from ml.src.data_loader import (
    load_training_data,
    load_predictions,
    prepare_features_and_target,
    ROOT,
)

MODEL_FILE = ROOT / "ml" / "models" / "academic_risk_model.joblib"


def test_no_data_leakage_in_features():
    """Verify that future ESE outcomes, target column, and student IDs are NOT features."""
    df = load_training_data()
    X, y, groups = prepare_features_and_target(df)

    forbidden_patterns = ["ese", "target", "student_id", "student_name"]
    for col in X.columns:
        col_lower = col.lower()
        if "ese" in col_lower:
            pytest.fail(f"Leakage detected: feature '{col}' contains future ESE marks!")
        if "student" in col_lower:
            pytest.fail(f"Leakage detected: feature '{col}' contains student identity!")

    assert "ese_percentage" not in X.columns
    assert "ese_below_40_percent" not in X.columns
    assert "student_id" not in X.columns


def test_model_feature_schema_matches_pipeline():
    """Verify that fitted model expects the exact features produced by data_loader."""
    model = joblib.load(MODEL_FILE)
    preprocessor = model.named_steps["preprocessor"]
    expected_features = list(preprocessor.feature_names_in_)

    df = load_training_data()
    X, _, _ = prepare_features_and_target(df)

    assert list(X.columns) == expected_features, (
        f"Feature mismatch between data and trained model! "
        f"Missing: {set(expected_features) - set(X.columns)}, Extra: {set(X.columns) - set(expected_features)}"
    )


def test_train_test_split_is_grouped_by_student():
    """Verify that GroupShuffleSplit creates strictly disjoint student sets."""
    df = load_training_data()
    X, y, groups = prepare_features_and_target(df)

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=groups))

    train_students = set(groups.iloc[train_idx])
    test_students = set(groups.iloc[test_idx])

    assert train_students.isdisjoint(test_students), "Data leakage: train and test student IDs overlap!"


def test_predictions_coverage_and_threshold_consistency():
    """Verify 100% prediction coverage and strict threshold mapping."""
    train_df = load_training_data()
    pred_df = load_predictions()

    # Exact 1:1 row count
    assert len(train_df) == len(pred_df) == 47550

    # Key alignment
    assert train_df["student_id"].equals(pred_df["student_id"])
    assert train_df["subject_key"].equals(pred_df["subject_key"])
    assert train_df["semester"].equals(pred_df["semester"])

    # Probabilities in [0, 1]
    probs = pred_df["predicted_risk_probability"]
    assert (probs >= 0.0).all() and (probs <= 1.0).all()

    # Binary class threshold: >= 0.50 -> 1, else 0
    expected_class = (probs >= 0.50).astype(int)
    assert pred_df["predicted_below_40"].equals(expected_class)

    # Risk level categories: <= 0.30 Low, (0.30, 0.60] Moderate, > 0.60 High
    for _, row in pred_df.sample(200, random_state=42).iterrows():
        p = row["predicted_risk_probability"]
        level = row["predicted_risk_level"]
        if p <= 0.30:
            assert level == "Low"
        elif p <= 0.60:
            assert level == "Moderate"
        else:
            assert level == "High"
