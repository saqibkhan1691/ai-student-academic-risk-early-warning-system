def test_get_student_subjects_default_semester(client):
    """Test retrieving enrolled subjects for student in default (current) semester."""
    student_id = "2428CS1020"
    response = client.get(f"/students/{student_id}/subjects")
    assert response.status_code == 200

    subjects = response.json()
    assert isinstance(subjects, list)
    assert len(subjects) > 0

    first = subjects[0]
    assert "subject_key" in first
    assert "subject_id" in first
    assert "subject_name" in first
    assert "attendance_percentage" in first
    assert 0.0 <= first["attendance_percentage"] <= 100.0

    # Risk summary checks
    risk = first.get("risk_summary")
    if risk is not None:
        assert 0.0 <= risk["predicted_risk_probability"] <= 1.0
        assert risk["predicted_risk_level"] in ["Low", "Moderate", "High"]
        assert risk["predicted_below_40"] in [0, 1]


def test_get_student_subjects_filtered_by_semester(client):
    """Test retrieving subjects filtered by semester 1."""
    student_id = "2428CS1020"
    response = client.get(f"/students/{student_id}/subjects?semester=1")
    assert response.status_code == 200

    subjects = response.json()
    assert len(subjects) > 0
    # In semester 1 CS, IoT and Embedded Systems (CS_EE101B) is enrolled
    subj_keys = [s["subject_key"] for s in subjects]
    assert "CS_EE101B" in subj_keys or any(k.startswith("CS_") for k in subj_keys)


def test_get_subjects_unknown_student_returns_404(client):
    """Test retrieving subjects for non-existent student returns 404."""
    unknown_id = "UNKNOWN_STUDENT_XYZ"
    response = client.get(f"/students/{unknown_id}/subjects")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
