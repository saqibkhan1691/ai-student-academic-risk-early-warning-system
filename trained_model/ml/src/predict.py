from pathlib import Path

import joblib
import pandas as pd

# ROOT resolves to trained_model/ (ml/src -> ml -> trained_model)
ROOT = Path(__file__).resolve().parents[2]

MODEL_PATH = ROOT / "ml" / "models" / "academic_risk_model.joblib"
DATA_PATH = ROOT / "data" / "processed" / "subject_level_training_data.csv"
OUTPUT_PATH = ROOT / "ml" / "reports" / "subject_level_predictions.csv"

TARGET = "ese_below_40_percent"

EXCLUDED_COLUMNS = [
    TARGET,
    "student_id",
    "student_name",
    "ese_percentage",
    "subject_id",
    "subject_name",
]


def main():
    print("Loading trained model...", flush=True)
    model = joblib.load(MODEL_PATH)

    print("Loading subject-level dataset...", flush=True)
    df = pd.read_csv(DATA_PATH)

    # Do not include ESE marks or the target in model inputs.
    X = df.drop(
        columns=[col for col in EXCLUDED_COLUMNS if col in df.columns]
    )

    print("Generating predictions...", flush=True)

    predictions = model.predict(X)
    probabilities = model.predict_proba(X)

    # Find which probability column corresponds to the below-40% class.
    classes = list(model.named_steps["classifier"].classes_)
    risk_class_index = classes.index(1)

    result = df.copy()
    result["predicted_below_40"] = predictions.astype(int)
    result["predicted_risk_probability"] = probabilities[:, risk_class_index]

    # Provisional categories, based on model probability rather than
    # validated institutional risk thresholds.
    result["predicted_risk_level"] = pd.cut(
        result["predicted_risk_probability"],
        bins=[-0.001, 0.30, 0.60, 1.0],
        labels=["Low", "Moderate", "High"],
        include_lowest=True,
    ).astype(str)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(OUTPUT_PATH, index=False)

    print("\nPrediction completed.")
    print(f"Total student-subject records: {len(result)}")
    print("\nRisk category counts:")
    print(result["predicted_risk_level"].value_counts().to_string())
    print(f"\nSaved predictions to: {OUTPUT_PATH}")

    print(
        "\nIMPORTANT: Predictions are experimental and based on synthetic "
        "data. Risk thresholds are provisional, not institutionally validated."
    )


if __name__ == "__main__":
    main()
