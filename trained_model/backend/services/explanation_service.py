"""
Service module for SHAP explanations: cached retrieval or on-demand computation.
"""

from typing import Dict, List, Optional, Tuple
import joblib
import numpy as np
import pandas as pd
import shap

from backend.config import (
    MODEL_PATH,
    SHAP_EXPLANATIONS_FILE,
    TRAINING_DATA_FILE,
    settings,
)
from backend.schemas.explanation import ExplanationResponse, FeatureContribution
from backend.services.student_service import student_exists, get_student_detail
from backend.services.subject_service import get_academic_df
from ml.src.explain import format_original_feature_value

_shap_df: Optional[pd.DataFrame] = None
_training_df: Optional[pd.DataFrame] = None
_model = None
_explainer = None
_bg_transformed = None
_feature_names: Optional[List[str]] = None
_risk_index: Optional[int] = None


class StudentNotFoundError(Exception):
    pass


class SubjectNotEnrolledError(Exception):
    pass


class ExplanationDataError(Exception):
    pass


def get_feature_display_label(feature_name: str) -> str:
    """Generate user-friendly feature label for UI rendering."""
    if feature_name == "residual_other_features":
        return "Other Omitted Factors"
    clean = feature_name
    if clean.startswith("numeric__"):
        clean = clean[len("numeric__"):]
    elif clean.startswith("categorical__"):
        clean = clean[len("categorical__"):]
    clean = clean.replace("_", " ").title()
    clean = clean.replace("Percentage", "%")
    return clean


def get_shap_cached_df() -> pd.DataFrame:
    global _shap_df
    if _shap_df is None:
        if not SHAP_EXPLANATIONS_FILE.exists():
            _shap_df = pd.DataFrame()
        else:
            _shap_df = pd.read_csv(SHAP_EXPLANATIONS_FILE)
    return _shap_df


def get_training_df() -> pd.DataFrame:
    global _training_df
    if _training_df is None:
        if not TRAINING_DATA_FILE.exists():
            raise FileNotFoundError(f"Training dataset missing at: {TRAINING_DATA_FILE}")
        df = pd.read_csv(TRAINING_DATA_FILE)
        if "subject_key" not in df.columns:
            df["subject_key"] = df["department_code"].astype(str) + "_" + df["subject_id"].astype(str)
        _training_df = df
    return _training_df


def get_or_create_explainer():
    """Lazy initialization of the model and SHAP explainer."""
    global _model, _explainer, _bg_transformed, _feature_names, _risk_index

    if _explainer is not None:
        return _model, _explainer, _feature_names, _risk_index

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Trained model artifact missing at: {MODEL_PATH}")

    _model = joblib.load(MODEL_PATH)
    preprocessor = _model.named_steps["preprocessor"]
    classifier = _model.named_steps["classifier"]
    _feature_names = list(preprocessor.get_feature_names_out())

    classes = list(classifier.classes_)
    if 1 not in classes:
        raise ValueError("Target class 1 (below-40% provisional risk) not in model classes.")
    _risk_index = classes.index(1)

    training_df = get_training_df()
    from ml.src.data_loader import prepare_features_and_target
    X_all, _, _ = prepare_features_and_target(training_df)

    rng = np.random.default_rng(settings.SHAP_RANDOM_STATE)
    bg_count = min(settings.SHAP_BACKGROUND_SIZE, len(X_all))
    bg_sample = X_all.iloc[rng.choice(len(X_all), size=bg_count, replace=False)]

    _bg_transformed = preprocessor.transform(bg_sample)
    if hasattr(_bg_transformed, "toarray"):
        _bg_transformed = _bg_transformed.toarray()
    _bg_transformed = np.asarray(_bg_transformed, dtype=float)

    def risk_prob_fn(transformed_input):
        transformed_input = np.asarray(transformed_input, dtype=float)
        if transformed_input.ndim == 1:
            transformed_input = transformed_input.reshape(1, -1)
        return classifier.predict_proba(transformed_input)[:, _risk_index]

    masker = shap.maskers.Independent(_bg_transformed, max_samples=bg_count)
    _explainer = shap.PermutationExplainer(
        risk_prob_fn,
        masker,
        feature_names=_feature_names,
        seed=settings.SHAP_RANDOM_STATE,
    )

    return _model, _explainer, _feature_names, _risk_index


def compute_on_demand_explanation(
    student_id: str,
    subject_key: str,
    semester: int,
) -> ExplanationResponse:
    """
    Compute individual SHAP explanation on-demand for an un-cached record.
    Preserves exact feature schema, top-10 ranking, and residual additivity closure.
    """
    model, explainer, feature_names, risk_idx = get_or_create_explainer()
    preprocessor = model.named_steps["preprocessor"]

    training_df = get_training_df()
    matches = training_df[
        (training_df["student_id"] == student_id)
        & (training_df["subject_key"] == subject_key)
        & (training_df["semester"] == semester)
    ]

    if matches.empty:
        raise ExplanationDataError(
            f"Preprocessed assessment feature data not found for student '{student_id}', "
            f"subject '{subject_key}', semester {semester}."
        )

    source_row = matches.iloc[0]
    subject_name = str(source_row.get("subject_name", ""))

    from ml.src.data_loader import prepare_features_and_target
    X_row, _, _ = prepare_features_and_target(matches)

    transformed_row = preprocessor.transform(X_row)
    if hasattr(transformed_row, "toarray"):
        transformed_row = transformed_row.toarray()
    transformed_row = np.asarray(transformed_row, dtype=float)

    # Compute prediction probability directly
    pred_prob = float(model.predict_proba(X_row)[0, risk_idx])

    # Run permutation explanation on the transformed row
    exp = explainer(transformed_row, max_evals=2 * transformed_row.shape[1] + 1)
    shap_vals = np.asarray(exp.values)[0]
    base_val = float(np.asarray(exp.base_values).reshape(-1)[0])
    total_reconstructed = float(base_val + shap_vals.sum())

    # Sort top 10 features by magnitude
    top_indices = np.argsort(np.abs(shap_vals))[::-1][: settings.SHAP_TOP_FEATURES]

    features: List[FeatureContribution] = []
    top_shap_sum = 0.0

    for rank, f_idx in enumerate(top_indices, start=1):
        feat_name = feature_names[f_idx]
        trans_val = float(transformed_row[0, f_idx])
        contrib = float(shap_vals[f_idx])
        top_shap_sum += contrib

        orig_val = format_original_feature_value(feat_name, source_row)
        display_lbl = get_feature_display_label(feat_name)

        impact = (
            "increases predicted below-40% probability"
            if contrib > 0
            else "decreases predicted below-40% probability"
            if contrib < 0
            else "no measurable contribution"
        )

        features.append(
            FeatureContribution(
                rank=rank,
                feature_name=feat_name,
                display_label=display_lbl,
                original_value=str(orig_val),
                transformed_value=trans_val,
                shap_value=contrib,
                impact_direction=impact,
                is_aggregate_residual=False,
            )
        )

    # Calculate residual contribution for exact additivity closure
    residual_shap = float((total_reconstructed - base_val) - top_shap_sum)
    residual_impact = (
        "increases predicted below-40% probability (aggregate of remaining features)"
        if residual_shap > 0
        else "decreases predicted below-40% probability (aggregate of remaining features)"
        if residual_shap < 0
        else "no measurable contribution"
    )

    features.append(
        FeatureContribution(
            rank=settings.SHAP_TOP_FEATURES + 1,
            feature_name="residual_other_features",
            display_label="Other Omitted Factors",
            original_value="Aggregate of remaining omitted features",
            transformed_value=None,
            shap_value=residual_shap,
            impact_direction=residual_impact,
            is_aggregate_residual=True,
        )
    )

    recon_error = abs(pred_prob - (base_val + top_shap_sum + residual_shap))

    return ExplanationResponse(
        student_id=student_id,
        subject_key=subject_key,
        subject_name=subject_name,
        semester=semester,
        base_probability=base_val,
        predicted_risk_probability=pred_prob,
        reconstructed_probability=total_reconstructed,
        reconstruction_error=recon_error,
        is_additivity_closed=(recon_error <= 1e-4),
        features=features,
    )


def get_explanation(
    student_id: str,
    subject_key: str,
    semester: Optional[int] = None,
) -> ExplanationResponse:
    """
    Retrieve SHAP explanation for a student-subject pair.
    Uses cached explanations if available; otherwise computes on demand.
    """
    # 1. Validate student existence
    if not student_exists(student_id):
        raise StudentNotFoundError(f"Student with ID '{student_id}' not found.")

    # 2. Validate course enrollment
    academic_df = get_academic_df()
    enrolled = academic_df[
        (academic_df["student_id"] == student_id) & (academic_df["subject_key"] == subject_key)
    ]

    if enrolled.empty:
        raise SubjectNotEnrolledError(
            f"Subject '{subject_key}' is not in enrolled courses for student '{student_id}'."
        )

    # Resolve semester
    if semester is not None:
        target_sem = semester
        if not (enrolled["semester"] == target_sem).any():
            raise SubjectNotEnrolledError(
                f"Student '{student_id}' is not enrolled in subject '{subject_key}' for semester {target_sem}."
            )
    else:
        target_sem = int(enrolled["semester"].iloc[0])

    # 3. Check cached explanations
    cached_df = get_shap_cached_df()
    if not cached_df.empty:
        cached_rows = cached_df[
            (cached_df["student_id"] == student_id)
            & (cached_df["subject_key"] == subject_key)
            & (cached_df["semester"] == target_sem)
        ]
        if not cached_rows.empty:
            sorted_rows = cached_rows.sort_values("feature_rank")
            base_p = float(sorted_rows["base_probability"].iloc[0])
            pred_p = float(sorted_rows["predicted_risk_probability"].iloc[0])
            recon_p = float(sorted_rows["reconstructed_probability"].iloc[0])
            subj_name = str(sorted_rows["subject_name"].iloc[0])

            features: List[FeatureContribution] = []
            for _, r in sorted_rows.iterrows():
                f_name = str(r["feature_name"])
                is_res = (f_name == "residual_other_features")
                trans_val = None if pd.isna(r["feature_value_transformed"]) else float(r["feature_value_transformed"])

                features.append(
                    FeatureContribution(
                        rank=int(r["feature_rank"]),
                        feature_name=f_name,
                        display_label=get_feature_display_label(f_name),
                        original_value=str(r["feature_value_original"]),
                        transformed_value=trans_val,
                        shap_value=float(r["shap_value"]),
                        impact_direction=str(r["impact_direction"]),
                        is_aggregate_residual=is_res,
                    )
                )

            shap_sum = sum(f.shap_value for f in features)
            recon_err = abs((base_p + shap_sum) - pred_p)

            return ExplanationResponse(
                student_id=student_id,
                subject_key=subject_key,
                subject_name=subj_name,
                semester=target_sem,
                base_probability=base_p,
                predicted_risk_probability=pred_p,
                reconstructed_probability=recon_p,
                reconstruction_error=recon_err,
                is_additivity_closed=(recon_err <= 1e-4),
                features=features,
            )

    # 4. Fallback to on-demand computation
    return compute_on_demand_explanation(student_id, subject_key, target_sem)
