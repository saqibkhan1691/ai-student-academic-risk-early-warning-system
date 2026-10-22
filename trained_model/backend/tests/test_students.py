def test_get_known_student_success(client):
    """Test retrieving an existing student with complete academic summary."""
    student_id = "2428CS1020"
    response = client.get(f"/students/{student_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["student_id"] == student_id
    assert data["department_code"] == "CS"
    assert data["department_name"] == "Computer Science"
    assert data["section"] == "A"
    assert data["program"] == "BTech"
    assert data["batch_year"] == 2028
    assert data["current_semester"] == 5

    # Check academic summary
    summary = data["academic_summary"]
    assert summary is not None
    assert isinstance(summary["cumulative_cgpa"], float)
    assert 0.0 <= summary["cumulative_cgpa"] <= 10.0
    assert 0.0 <= summary["semester_attendance_percentage"] <= 100.0
    assert summary["total_subjects_enrolled"] > 0
    assert summary["data_status"] == "synthetic_demo"


def test_get_known_student_api_v1_alias(client):
    """Test retrieving student through /api/v1 prefix."""
    student_id = "2428CS1020"
    response = client.get(f"/api/v1/students/{student_id}")
    assert response.status_code == 200
    assert response.json()["student_id"] == student_id


def test_get_unknown_student_returns_404(client):
    """Test retrieving a non-existent student returns 404."""
    unknown_id = "NONEXISTENT_STUDENT_ID"
    response = client.get(f"/students/{unknown_id}")
    assert response.status_code == 404
    error_detail = response.json()["detail"]
    assert unknown_id in error_detail
    assert "not found" in error_detail.lower()
