from app.main import app


def test_openapi_inventory_has_no_legacy_admin_mock_route():
    paths = app.openapi()["paths"]
    operations = sum(
        method in {"get", "post", "put", "patch", "delete"}
        for item in paths.values()
        for method in item
    )
    assert "/api/v1/admin/users" not in paths
    assert operations == 70


def test_health_endpoint():
    from fastapi.testclient import TestClient

    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
