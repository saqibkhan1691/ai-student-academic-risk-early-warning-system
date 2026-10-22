from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
import shap


# =========================================================
# CONFIGURATION
# =========================================================

# ROOT resolves to trained_model/ (ml/src -> ml -> trained_model)
ROOT = Path(__file__).resolve().parents[2]

MODEL_PATH = ROOT / "ml" / "models" / "academic_risk_model.joblib"
DATA_PATH = ROOT / "data" / "processed" / "subject_level_training_data.csv"
PREDICTIONS_PATH = ROOT / "ml" / "reports" / "subject_level_predictions.csv"

OUTPUT_PATH = ROOT / "ml" / "reports" / "individual_shap_explanations.csv"
VALIDATION_PATH = ROOT / "ml" / "reports" / "shap_validation_report.json"

TARGET = "ese_below_40_percent"

EXCLUDED_COLUMNS = {
    TARGET,
    "ese_percentage",
    "student_id",
    "student_name",
    "subject_id",
    "subject_name",
}

MAX_RECORDS = 100
BACKGROUND_SIZE = 20
TOP_FEATURES = 10
RANDOM_STATE = 42
ADDITIVITY_TOLERANCE = 1e-4


# =========================================================
# UTILITIES
# =========================================================

def save_validation(report):
    VALIDATION_PATH.parent.mkdir(parents=True, exist_ok=True)

    with open(VALIDATION_PATH, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=2, default=str)


def transform_to_dense(preprocessor, data):
    transformed = preprocessor.transform(data)

    if hasattr(transformed, "toarray"):
        transformed = transformed.toarray()

    return np.asarray(transformed, dtype=float)


def format_original_feature_value(feature_name, source_row):
    """
    Map transformed feature name back to original feature value / percentage.
    Standardized z-scores are kept distinct from actual student marks/percentages.
    """
    if feature_name.startswith("numeric__"):
        raw_col = feature_name[len("numeric__"):]
        raw_val = source_row.get(raw_col)
        if raw_val is None or pd.isna(raw_val):
            return "Missing (imputed with median)"

        percentage_cols = {
            "assignment_1", "assignment_2", "assignment_3",
            "assignment_4", "assignment_5", "assignment_6",
            "class_test_1", "class_test_2", "mid_semester_1",
            "other_internal_1", "assignment_completion_percentage",
        }
        if raw_col in percentage_cols:
            return f"{float(raw_val):.2f}%"

        if raw_col in {"semester", "assignment_count", "assignments_submitted"}:
            return str(int(raw_val)) if float(raw_val).is_integer() else str(raw_val)

        return str(raw_val)

    if feature_name.startswith("categorical__"):
        for cat_col in ["department_code", "section", "subject_key"]:
            prefix = f"categorical__{cat_col}_"
            if feature_name.startswith(prefix):
                target_cat = feature_name[len(prefix):]
                actual_cat = str(source_row.get(cat_col))
                matches = (target_cat == actual_cat)
                return f"{actual_cat} (matches '{target_cat}': {matches})"
        return "Categorical indicator"

    return "N/A"


# =========================================================
# MAIN
# =========================================================

def main():
    report = {
        "status": "started",
        "shap_version": shap.__version__,
        "warnings": [
            "The academic dataset contains synthetic/demo records.",
            "SHAP values describe model contributions, not causality.",
            "Risk thresholds and predictions are not validated for "
            "real institutional use.",
            "This run explains a sample, not the complete dataset.",
        ],
    }

    print("1. Loading model and CSV files...", flush=True)

    model = joblib.load(MODEL_PATH)
    df = pd.read_csv(DATA_PATH)
    predictions_df = pd.read_csv(PREDICTIONS_PATH)

    if df.empty:
        raise ValueError("The training dataset is empty.")

    if len(df) != len(predictions_df):
        raise ValueError(
            "Training dataset and predictions CSV have different row counts."
        )

    report["dataset_rows"] = len(df)
    report["prediction_rows"] = len(predictions_df)

    # -----------------------------------------------------
    # Verify identity and row alignment
    # -----------------------------------------------------

    identity_columns = [
        col
        for col in ["student_id", "subject_key", "subject_id", "semester"]
        if col in df.columns and col in predictions_df.columns
    ]

    if "student_id" not in identity_columns:
        raise ValueError(
            "student_id must exist in both CSV files."
        )

    for col in identity_columns:
        if not df[col].reset_index(drop=True).equals(
            predictions_df[col].reset_index(drop=True)
        ):
            raise ValueError(
                f"Record alignment failed for {col}. "
                "Regenerate predictions before running explanations."
            )

    report["identity_columns_verified"] = identity_columns

    # -----------------------------------------------------
    # Prepare the exact model inputs
    # -----------------------------------------------------

    print("2. Preparing exact model input features...", flush=True)

    preprocessor = model.named_steps["preprocessor"]
    classifier = model.named_steps["classifier"]

    X_all = df.drop(
        columns=[
            col for col in EXCLUDED_COLUMNS
            if col in df.columns
        ]
    )

    expected_features = list(preprocessor.feature_names_in_)

    if list(X_all.columns) != expected_features:
        missing = sorted(set(expected_features) - set(X_all.columns))
        extra = sorted(set(X_all.columns) - set(expected_features))

        raise ValueError(
            "Input feature schema mismatch. "
            f"Missing={missing}; extra={extra}"
        )

    report["raw_feature_count"] = len(expected_features)
    report["raw_feature_mapping_verified"] = True

    # -----------------------------------------------------
    # Select a deterministic sample
    # -----------------------------------------------------

    sample_count = min(MAX_RECORDS, len(df))
    rng = np.random.default_rng(RANDOM_STATE)

    sample_indices = np.sort(
        rng.choice(len(df), size=sample_count, replace=False)
    )

    X_sample = X_all.iloc[sample_indices].copy()

    # Transform with the fitted training preprocessor.
    transformed_sample = transform_to_dense(
        preprocessor,
        X_sample,
    )

    transformed_feature_names = list(
        preprocessor.get_feature_names_out()
    )

    if len(transformed_feature_names) != transformed_sample.shape[1]:
        raise ValueError(
            "Transformed feature names do not match transformed matrix width."
        )

    report["transformed_feature_count"] = transformed_sample.shape[1]
    report["transformed_feature_mapping_verified"] = True

    # -----------------------------------------------------
    # Verify predictions
    # -----------------------------------------------------

    print("3. Verifying saved predictions...", flush=True)

    classes = list(classifier.classes_)

    if 1 not in classes:
        raise ValueError(
            "Model class 1 (below-40% target) was not found."
        )

    risk_index = classes.index(1)

    model_probabilities = model.predict_proba(
        X_sample
    )[:, risk_index]

    saved_probabilities = predictions_df.iloc[sample_indices][
        "predicted_risk_probability"
    ].to_numpy(dtype=float)

    prediction_error = float(
        np.max(np.abs(model_probabilities - saved_probabilities))
    )

    report["max_saved_prediction_difference"] = prediction_error

    if not np.allclose(
        model_probabilities,
        saved_probabilities,
        atol=1e-6,
        rtol=1e-5,
    ):
        raise ValueError(
            "Saved prediction probabilities do not match the current model. "
            "Run python -m ml.src.predict first."
        )

    # -----------------------------------------------------
    # Prepare transformed background data
    # -----------------------------------------------------

    print("4. Preparing numerical model-agnostic explainer...", flush=True)

    background_count = min(BACKGROUND_SIZE, len(X_all))

    background_indices = rng.choice(
        len(X_all),
        size=background_count,
        replace=False,
    )

    background_raw = X_all.iloc[background_indices].copy()

    background_transformed = transform_to_dense(
        preprocessor,
        background_raw,
    )

    if background_transformed.shape[1] != transformed_sample.shape[1]:
        raise ValueError(
            "Background and sample transformed feature dimensions differ."
        )

    # IMPORTANT:
    # Explain the classifier in the exact numerical space it receives.
    # Do not pass raw categorical strings into the SHAP masker.
    def risk_probability_function(transformed_input):
        transformed_input = np.asarray(
            transformed_input,
            dtype=float,
        )

        if transformed_input.ndim == 1:
            transformed_input = transformed_input.reshape(1, -1)

        return classifier.predict_proba(
            transformed_input
        )[:, risk_index]

    masker = shap.maskers.Independent(
        background_transformed,
        max_samples=background_count,
    )

    explainer = shap.PermutationExplainer(
        risk_probability_function,
        masker,
        feature_names=transformed_feature_names,
        seed=RANDOM_STATE,
    )

    # -----------------------------------------------------
    # Calculate SHAP values
    # -----------------------------------------------------

    print("5. Calculating individual SHAP explanations...", flush=True)

    # Permutation SHAP is approximate. This evaluation budget
    # uses one forward and one reverse permutation.
    explanation = explainer(
        transformed_sample,
        max_evals=2 * transformed_sample.shape[1] + 1,
        batch_size=10,
    )

    shap_values = np.asarray(explanation.values)
    base_values = np.asarray(explanation.base_values)

    if shap_values.ndim != 2:
        raise ValueError(
            f"Unexpected SHAP values shape: {shap_values.shape}"
        )

    if shap_values.shape != transformed_sample.shape:
        raise ValueError(
            f"SHAP shape {shap_values.shape} does not match "
            f"input shape {transformed_sample.shape}."
        )

    base_values = base_values.reshape(-1)

    if len(base_values) != len(X_sample):
        raise ValueError(
            f"Unexpected SHAP base values shape: {base_values.shape}"
        )

    # -----------------------------------------------------
    # Independent probability reconstruction validation
    # -----------------------------------------------------

    reconstructed_probabilities = (
        base_values + shap_values.sum(axis=1)
    )

    max_additivity_error = float(
        np.max(
            np.abs(
                reconstructed_probabilities - model_probabilities
            )
        )
    )

    report["max_probability_reconstruction_error"] = (
        max_additivity_error
    )

    print(
        "Maximum probability reconstruction error:",
        f"{max_additivity_error:.8f}",
        flush=True,
    )

    print(
        "Model probabilities (first 5):",
        model_probabilities[:5],
    )

    print(
        "Reconstructed probabilities (first 5):",
        reconstructed_probabilities[:5],
    )

    if max_additivity_error > ADDITIVITY_TOLERANCE:
        report["status"] = "failed_additivity_validation"
        save_validation(report)

        raise ValueError(
            "SHAP probability reconstruction failed validation. "
            "No explanation CSV was saved. Check the validation report."
        )

    # -----------------------------------------------------
    # Build long-format explanation CSV
    # -----------------------------------------------------

    print("6. Building feature-level explanations...", flush=True)

    records = []

    for local_index, original_index in enumerate(sample_indices):
        source_row = df.iloc[original_index]
        prediction_row = predictions_df.iloc[original_index]

        feature_order = np.argsort(
            np.abs(shap_values[local_index])
        )[::-1][:TOP_FEATURES]

        for rank, feature_index in enumerate(feature_order, start=1):
            contribution = float(
                shap_values[local_index, feature_index]
            )

            feature_name = transformed_feature_names[feature_index]
            transformed_value = float(
                transformed_sample[local_index, feature_index]
            )

            orig_val_str = format_original_feature_value(
                feature_name, source_row
            )

            records.append({
                "student_id": source_row.get("student_id"),
                "subject_id": source_row.get("subject_id"),
                "subject_key": source_row.get("subject_key"),
                "subject_name": source_row.get("subject_name"),
                "semester": source_row.get("semester"),
                "section": source_row.get("section"),
                "predicted_risk_probability": float(
                    model_probabilities[local_index]
                ),
                "predicted_risk_level": prediction_row.get(
                    "predicted_risk_level"
                ),
                "base_probability": float(base_values[local_index]),
                "reconstructed_probability": float(
                    reconstructed_probabilities[local_index]
                ),
                "feature_rank": rank,
                "feature_name": feature_name,
                "feature_value_transformed": transformed_value,
                "feature_value_original": orig_val_str,
                "shap_value": contribution,
                "impact_direction": (
                    "increases predicted below-40% probability"
                    if contribution > 0
                    else "decreases predicted below-40% probability"
                    if contribution < 0
                    else "no measurable contribution"
                ),
            })

        # Calculate residual contribution of omitted features so that
        # base_probability + sum(exported contributions) reconstructs
        # model probability within tolerance.
        top_shap_sum = float(
            np.sum(shap_values[local_index, feature_order])
        )
        total_shap_sum = float(
            reconstructed_probabilities[local_index] - base_values[local_index]
        )
        residual_shap = float(total_shap_sum - top_shap_sum)

        records.append({
            "student_id": source_row.get("student_id"),
            "subject_id": source_row.get("subject_id"),
            "subject_key": source_row.get("subject_key"),
            "subject_name": source_row.get("subject_name"),
            "semester": source_row.get("semester"),
            "section": source_row.get("section"),
            "predicted_risk_probability": float(
                model_probabilities[local_index]
            ),
            "predicted_risk_level": prediction_row.get(
                "predicted_risk_level"
            ),
            "base_probability": float(base_values[local_index]),
            "reconstructed_probability": float(
                reconstructed_probabilities[local_index]
            ),
            "feature_rank": TOP_FEATURES + 1,
            "feature_name": "residual_other_features",
            "feature_value_transformed": np.nan,
            "feature_value_original": "Aggregate of remaining omitted features",
            "shap_value": residual_shap,
            "impact_direction": (
                "increases predicted below-40% probability (aggregate of remaining features)"
                if residual_shap > 0
                else "decreases predicted below-40% probability (aggregate of remaining features)"
                if residual_shap < 0
                else "no measurable contribution"
            ),
        })

    output_df = pd.DataFrame(records)

    required_columns = [
        "student_id",
        "subject_id",
        "subject_key",
        "predicted_risk_probability",
        "feature_name",
        "feature_value_transformed",
        "feature_value_original",
        "shap_value",
    ]

    missing_columns = [
        col for col in required_columns
        if col not in output_df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Required output columns are missing: {missing_columns}"
        )

    # -----------------------------------------------------
    # Verify CSV reconstructed additivity with residual row
    # -----------------------------------------------------
    csv_additivity_errors = []
    for (sid, skey, sem), group in output_df.groupby(
        ["student_id", "subject_key", "semester"]
    ):
        group_base = group["base_probability"].iloc[0]
        group_shap_sum = group["shap_value"].sum()
        group_pred_prob = group["predicted_risk_probability"].iloc[0]
        err = abs(group_base + group_shap_sum - group_pred_prob)
        csv_additivity_errors.append(err)

    max_csv_additivity_error = float(np.max(csv_additivity_errors))
    report["max_csv_additivity_error"] = max_csv_additivity_error
    print(
        f"Maximum CSV reconstruction error (with residual row): {max_csv_additivity_error:.8e}",
        flush=True,
    )

    if max_csv_additivity_error > ADDITIVITY_TOLERANCE:
        raise ValueError(
            f"CSV additivity reconstruction failed tolerance: {max_csv_additivity_error}"
        )

    # -----------------------------------------------------
    # Save only after successful validation
    # -----------------------------------------------------

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(OUTPUT_PATH, index=False)

    report["status"] = "passed"
    report["explained_records"] = len(X_sample)
    report["feature_contributions_saved"] = len(output_df)
    report["output_file"] = str(OUTPUT_PATH)
    report["validation_file"] = str(VALIDATION_PATH)

    save_validation(report)

    print("\nSHAP explanations generated and validated.")
    print(f"Explained records: {len(X_sample)}")
    print(f"Feature contributions: {len(output_df)}")
    print(f"Maximum reconstruction error: {max_additivity_error:.8f}")
    print(f"Explanations saved to: {OUTPUT_PATH}")
    print(f"Validation report saved to: {VALIDATION_PATH}")

    print(
        "\nNOTE: Only a sample was explained. Transformed feature values "
        "are not original marks. SHAP contributions are not causal reasons."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\nVALIDATION FAILED: {exc}", flush=True)
        raise
