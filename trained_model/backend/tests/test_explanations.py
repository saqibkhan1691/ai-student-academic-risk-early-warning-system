def test_get_cached_explanation_success(client):
    """Test retrieving a pre-computed validated SHAP explanation from cache."""
    student_id = "2428CS2071"
    subject_key = "CS_MA101L"
    semester = 1

    response = client.get(
        f"/students/{student_id}/subjects/{subject_key}/explanation?semester={semester}"
    )
    assert response.status_code == 200

    data = response.json()
    assert data["student_id"] == student_id
    assert data["subject_key"] == subject_key
    assert data["semester"] == semester
    assert data["subject_name"] == "Calculus for Engineers"

    # Probability bounds
    assert 0.0 <= data["predicted_risk_probability"] <= 1.0
    assert 0.0 <= data["base_probability"] <= 1.0

    # Additivity closure
    assert data["is_additivity_closed"] is True
    assert data["reconstruction_error"] <= 1e-4

    # Feature attributions
    features = data["features"]
    assert len(features) == 11, "Must contain top 10 features + 1 aggregate residual!"

    # Check top features (ranks 1 to 10)
    for f in features[:10]:
        assert f["rank"] in range(1, 11)
        assert f["is_aggregate_residual"] is False
        assert f["display_label"] is not None
        assert f["impact_direction"] in [
            "increases predicted below-40% probability",
            "decreases predicted below-40% probability",
            "no measurable contribution",
        ]
        # Transformed value should be float (z-score or one-hot), not null
        assert f["transformed_value"] is not None

    # Check residual row (rank 11)
    residual = features[10]
    assert residual["rank"] == 11
    assert residual["feature_name"] == "residual_other_features"
    assert residual["is_aggregate_residual"] is True
    assert residual["transformed_value"] is None
    assert "aggregate" in residual["original_value"].lower()


def test_get_on_demand_explanation_for_uncached_record(client):
    """Test computing an on-demand SHAP explanation for a record not in the initial sample."""
    # Student 2428CS1020 in EE101B is not in individual_shap_explanations.csv (which was sampled to 100)
    student_id = "2428CS1020"
    subject_key = "CS_EE101B"
    semester = 1

    response = client.get(
        f"/students/{student_id}/subjects/{subject_key}/explanation?semester={semester}"
    )
    assert response.status_code == 200

    data = response.json()
    assert data["student_id"] == student_id
    assert data["subject_key"] == subject_key
    assert data["semester"] == semester
    assert len(data["features"]) == 11
    assert data["is_additivity_closed"] is True
    assert data["reconstruction_error"] <= 1e-4

    # Verify identity matching
    assert data["features"][10]["feature_name"] == "residual_other_features"


def test_explanation_unknown_student_returns_404(client):
    """Test explanation endpoint returns 404 for unknown student."""
    response = client.get(
        "/students/UNKNOWN_STUDENT_ID/subjects/CS_MA101L/explanation"
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_explanation_unenrolled_subject_returns_404(client):
    """Test explanation endpoint returns 404 if student is not enrolled in course."""
    student_id = "2428CS1020"
    unenrolled_subject = "ECE_EC999L"
    response = client.get(
        f"/students/{student_id}/subjects/{unenrolled_subject}/explanation"
    )
    assert response.status_code == 404
    assert "not in enrolled courses" in response.json()["detail"].lower()


def test_explanation_data_strictly_matches_request_identity(client):
    """Confirm SHAP explanation data belongs strictly to requested student and subject."""
    student_id = "2428CS2071"
    subject_key = "CS_MA101L"
    response = client.get(
        f"/students/{student_id}/subjects/{subject_key}/explanation"
    )
    assert response.status_code == 200
    data = response.json()

    assert data["student_id"] == student_id
    assert data["subject_key"] == subject_key
    assert data["subject_name"] == "Calculus for Engineers"
