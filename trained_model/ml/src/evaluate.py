from pathlib import Path
import json

import joblib
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

# ROOT resolves to trained_model/ (ml/src -> ml -> trained_model)
ROOT = Path(__file__).resolve().parents[2]
DATA_FILE = ROOT / "data" / "processed" / "subject_level_training_data.csv"
MODEL_FILE = ROOT / "ml" / "models" / "academic_risk_model.joblib"
REPORT_DIR = ROOT / "ml" / "reports"
OUTPUT_REPORT = REPORT_DIR / "model_evaluation.json"

TARGET = "ese_below_40_percent"
GROUP = "student_id"


def evaluate():
    print("Loading test data and trained model...", flush=True)
    df = pd.read_csv(DATA_FILE)
    model = joblib.load(MODEL_FILE)

    excluded = [
        TARGET,
        GROUP,
        "ese_percentage",
        "student_name",
        "subject_id",
        "subject_name",
    ]
    X = df.drop(columns=[c for c in excluded if c in df.columns])
    y = df[TARGET]
    groups = df[GROUP]

    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=0.20,
        random_state=42,
    )
    train_idx, test_idx = next(splitter.split(X, y, groups=groups))

    X_test = X.iloc[test_idx].copy()
    y_test = y.iloc[test_idx].copy()
    test_groups = groups.iloc[test_idx]

    train_ids = set(groups.iloc[train_idx])
    test_ids = set(test_groups)
    assert train_ids.isdisjoint(test_ids), "Data leakage detected: train and test student IDs overlap!"

    print("Running evaluation on held-out test split...", flush=True)
    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)

    classes = list(model.named_steps["classifier"].classes_)
    risk_idx = classes.index(1)
    risk_probs = probabilities[:, risk_idx]

    acc = float(accuracy_score(y_test, predictions))
    macro_f1 = float(f1_score(y_test, predictions, average="macro", zero_division=0))
    below_40_precision = float(precision_score(y_test, predictions, pos_label=1, zero_division=0))
    below_40_recall = float(recall_score(y_test, predictions, pos_label=1, zero_division=0))
    below_40_f1 = float(f1_score(y_test, predictions, pos_label=1, zero_division=0))

    cm = confusion_matrix(y_test, predictions, labels=[0, 1])
    # cm layout: [[TN, FP], [FN, TP]]
    tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])
    missed_below_40 = fn  # False Negatives: actual below-40% but predicted 40% or above

    clf_report = classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["40% or above", "Below 40%"],
        zero_division=0,
        output_dict=True,
    )

    evaluation_results = {
        "dataset_type": "synthetic",
        "target": TARGET,
        "target_status": "provisional, synthetic dataset",
        "disclaimer": "Predictions are experimental; dataset is synthetic; not validated for real students or institutional use.",
        "test_records": len(y_test),
        "test_students": len(test_ids),
        "accuracy": acc,
        "macro_f1": macro_f1,
        "below_40_class": {
            "precision": below_40_precision,
            "recall": below_40_recall,
            "f1": below_40_f1,
            "actual_positive_cases": int((y_test == 1).sum()),
            "predicted_positive_cases": int((predictions == 1).sum()),
            "missed_cases_fn": missed_below_40,
        },
        "confusion_matrix": {
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives_missed": fn,
            "true_positives": tp,
            "raw_matrix": cm.tolist(),
        },
        "classification_report": clf_report,
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(evaluation_results, f, indent=2)

    print("\n" + "=" * 55)
    print("MODEL EVALUATION REPORT (HELD-OUT TEST SPLIT)")
    print("=" * 55)
    print(f"Test Student-Subject Records: {len(y_test)}")
    print(f"Test Students (Group Partition): {len(test_ids)}")
    print(f"Accuracy:                    {acc:.4f}")
    print(f"Macro F1:                    {macro_f1:.4f}")
    print(f"Below-40% Class Precision:   {below_40_precision:.4f}")
    print(f"Below-40% Class Recall:      {below_40_recall:.4f}")
    print(f"Below-40% Class F1:          {below_40_f1:.4f}")
    print(f"\nConfusion Matrix [[TN, FP], [FN, TP]]:\n{cm}")
    print(f"  - Correctly identified high risk (TP): {tp}")
    print(f"  - Correctly identified safe (TN):      {tn}")
    print(f"  - False alarms (FP):                  {fp}")
    print(f"  - MISSED below-40% cases (FN):         {missed_below_40}")
    print("\nClassification Report:")
    print(classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["40% or above", "Below 40%"],
        zero_division=0,
    ))
    print(f"Evaluation report saved to: {OUTPUT_REPORT}")
    print("WARNING: Dataset is synthetic and target is provisional. Not validated for real institutional use.")
    print("=" * 55)


if __name__ == "__main__":
    evaluate()
