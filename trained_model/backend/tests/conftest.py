import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Session-scoped test client for FastAPI backend."""
    with TestClient(app) as test_client:
        yield test_client
