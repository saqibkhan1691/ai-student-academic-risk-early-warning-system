def test_health_check_root(client):
    """Test GET /health returns healthy status and metadata."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "1.0.0"
    assert data["dataset_status"] == "synthetic_demo_loaded"
    assert data["model_status"] == "available"
    assert "synthetic" in data["disclaimer"].lower()


def test_health_check_api_v1(client):
    """Test GET /api/v1/health alias returns identical status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
