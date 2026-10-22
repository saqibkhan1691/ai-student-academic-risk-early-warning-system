from pathlib import Path
import pandas as pd

# ROOT resolves to trained_model/ (ml/src -> ml -> trained_model)
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "raw"
OUTPUT_DIR = ROOT / "data" / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def build_subject_dataset():
    path = DATA_DIR / "assessment_details.csv"
    df = pd.read_csv(path)

    required = {
        "student_id", "department_code", "section", "semester",
        "subject_id", "subject_name", "assessment_type",
        "assessment_number", "marks_obtained", "max_marks", "submitted"
    }

    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    # Create composite subject key to resolve collisions across departments (e.g. IT301L)
    df["subject_key"] = df["department_code"] + "_" + df["subject_id"]

    keys = [
        "student_id", "department_code", "section",
        "semester", "subject_id", "subject_key", "subject_name"
    ]

    # Keep only assessment information that can be available before ESE.
    pre_ese = df[
        df["assessment_type"].isin([
            "Mid Semester", "Class Test", "Assignment", "Other Internal"
        ])
    ].copy()

    pre_ese["marks_obtained"] = pd.to_numeric(
        pre_ese["marks_obtained"], errors="coerce"
    )
    pre_ese["max_marks"] = pd.to_numeric(
        pre_ese["max_marks"], errors="coerce"
    )

    pre_ese["percentage"] = (
        pre_ese["marks_obtained"] / pre_ese["max_marks"].replace(0, pd.NA)
    ) * 100

    # Assessment type and number become separate feature columns.
    pre_ese["feature_name"] = (
        pre_ese["assessment_type"].str.lower().str.replace(" ", "_")
        + "_"
        + pre_ese["assessment_number"].astype(str)
    )

    scores = pre_ese.pivot_table(
        index=keys,
        columns="feature_name",
        values="percentage",
        aggfunc="first"
    ).reset_index()

    scores.columns.name = None

    # Assignment completion features
    assignments = df[df["assessment_type"] == "Assignment"].copy()

    assignments["submitted_flag"] = (
        assignments["submitted"].astype(str).str.lower().eq("true")
    )

    assignment_summary = assignments.groupby(keys).agg(
        assignment_count=("assessment_number", "count"),
        assignments_submitted=("submitted_flag", "sum"),
    ).reset_index()

    assignment_summary["assignment_completion_percentage"] = (
        assignment_summary["assignments_submitted"]
        / assignment_summary["assignment_count"].replace(0, pd.NA)
        * 100
    )

    scores = scores.merge(assignment_summary, on=keys, how="left")

    # ESE outcome: use the ESE percentage as a provisional target.
    ese = df[df["assessment_type"] == "End Semester"].copy()
    ese["marks_obtained"] = pd.to_numeric(
        ese["marks_obtained"], errors="coerce"
    )
    ese["max_marks"] = pd.to_numeric(ese["max_marks"], errors="coerce")

    ese["ese_percentage"] = (
        ese["marks_obtained"] / ese["max_marks"].replace(0, pd.NA)
    ) * 100

    ese = ese[keys + ["ese_percentage"]]

    result = scores.merge(
        ese, on=keys, how="inner", validate="one_to_one"
    )

    # Provisional binary outcome only; verify official ESE pass rules first.
    result["ese_below_40_percent"] = (
        result["ese_percentage"] < 40
    ).astype(int)

    output_path = OUTPUT_DIR / "subject_level_training_data.csv"
    result.to_csv(output_path, index=False)

    print("Subject-level dataset created")
    print("Rows:", len(result))
    print("Unique students:", result["student_id"].nunique())
    print("Unique subject IDs:", result["subject_id"].nunique())
    print("Unique composite subject keys:", result["subject_key"].nunique())
    print("\nProvisional ESE outcome distribution:")
    print(result["ese_below_40_percent"].value_counts().to_string())
    print("\nSaved:", output_path)
    print("\nReminder: verify ESE pass criteria and feature availability before training.")


if __name__ == "__main__":
    build_subject_dataset()