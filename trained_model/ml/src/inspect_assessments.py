from pathlib import Path
import pandas as pd

# ROOT resolves to trained_model/ (ml/src -> ml -> trained_model)
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "raw"

academic = pd.read_csv(DATA_DIR / "academic_records.csv")
assessments = pd.read_csv(DATA_DIR / "assessment_details.csv")

print("\n=== ACADEMIC COMPONENTS ===")
print(academic["component"].value_counts(dropna=False).to_string())

print("\n=== ASSESSMENT TYPES ===")
print(assessments["assessment_type"].value_counts(dropna=False).to_string())

print("\n=== ASSESSMENT TYPE + NUMBER ===")
print(
    assessments.groupby(
        ["assessment_type", "assessment_number"],
        dropna=False
    ).size().to_string()
)

print("\n=== SUBJECT RESULT DISTRIBUTION ===")
print(academic["subject_result"].value_counts(dropna=False).to_string())

print("\n=== AVAILABLE ASSESSMENT COLUMNS ===")
print(assessments.columns.tolist())

print("\n=== SAMPLE ASSESSMENTS ===")
print(assessments.head(20).to_string(index=False))

print("\nInspection completed.")
