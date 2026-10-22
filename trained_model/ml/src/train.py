from pathlib import Path
import json

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    recall_score,
)
from sklearn.utils.class_weight import compute_sample_weight


# ROOT resolves to trained_model/ (ml/src -> ml -> trained_model)
ROOT = Path(__file__).resolve().parents[2]
DATA_FILE = ROOT / "data" / "processed" / "subject_level_training_data.csv"
MODEL_DIR = ROOT / "ml" / "models"
REPORT_DIR = ROOT / "ml" / "reports"

TARGET = "ese_below_40_percent"
GROUP = "student_id"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    df = pd.read_csv(DATA_FILE)

    # IDs, display metadata, ESE marks, and the target must never be model inputs.
    # Exclude subject_id and subject_name to prevent redundant collinear predictors,
    # relying on the unique composite subject_key instead.
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

    X_train, X_test = X.iloc[train_idx].copy(), X.iloc[test_idx].copy()
    y_train, y_test = y.iloc[train_idx].copy(), y.iloc[test_idx].copy()

    train_ids = set(groups.iloc[train_idx])
    test_ids = set(groups.iloc[test_idx])
    assert train_ids.isdisjoint(test_ids)

    categorical = X_train.select_dtypes(
        include=["object", "category", "bool"]
    ).columns.tolist()
    numeric = [c for c in X_train.columns if c not in categorical]

    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore")),
    ])

    preprocessor = ColumnTransformer([
        ("numeric", numeric_pipeline, numeric),
        ("categorical", categorical_pipeline, categorical),
    ])

    models = {
        "logistic_regression": LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            random_state=42,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=250,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        ),
    }

    results = {}
    trained_models = {}

    for name, classifier in models.items():
        pipeline = Pipeline([
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ])

        if name == "random_forest":
            weights = compute_sample_weight(
                class_weight="balanced",
                y=y_train,
            )
            pipeline.fit(
                X_train,
                y_train,
                classifier__sample_weight=weights,
            )
        else:
            pipeline.fit(X_train, y_train)

        pred = pipeline.predict(X_test)

        report = classification_report(
            y_test,
            pred,
            labels=[0, 1],
            target_names=["40% or above", "Below 40%"],
            zero_division=0,
            output_dict=True,
        )
        matrix = confusion_matrix(y_test, pred, labels=[0, 1])

        results[name] = {
            "accuracy": float(accuracy_score(y_test, pred)),
            "macro_f1": float(
                f1_score(y_test, pred, average="macro", zero_division=0)
            ),
            "below_40_recall": float(
                recall_score(y_test, pred, pos_label=1, zero_division=0)
            ),
            "classification_report": report,
            "confusion_matrix": matrix.tolist(),
        }
        trained_models[name] = pipeline

        print(f"\n=== {name} ===")
        print(f"Accuracy: {results[name]['accuracy']:.4f}")
        print(f"Macro F1: {results[name]['macro_f1']:.4f}")
        print(f"Below-40% recall: {results[name]['below_40_recall']:.4f}")
        print(classification_report(
            y_test,
            pred,
            labels=[0, 1],
            target_names=["40% or above", "Below 40%"],
            zero_division=0,
        ))
        print("Confusion matrix:\n", matrix)

    best_name = max(results, key=lambda n: results[n]["macro_f1"])
    joblib.dump(
        trained_models[best_name],
        MODEL_DIR / "academic_risk_model.joblib",
    )

    with open(REPORT_DIR / "model_comparison.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "target": TARGET,
                "target_status": "provisional, synthetic dataset",
                "disclaimer": "Predictions are experimental; dataset is synthetic; not validated for real students.",
                "subject_predictor": "subject_key (composite department_code + '_' + subject_id)",
                "excluded_features": excluded,
                "best_by_macro_f1": best_name,
                "results": results,
            },
            f,
            indent=2,
        )

    print("\nBest initial model:", best_name)
    print("Saved model:", MODEL_DIR / "academic_risk_model.joblib")
    print("Saved report:", REPORT_DIR / "model_comparison.json")
    print("WARNING: These results are experimental, not real-world validation.")


if __name__ == "__main__":
    main()
