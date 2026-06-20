import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "AI Service Running "}

def test_weather_insights_missing_params():
    # Calling insights without lat/lng parameters should return 422 validation error
    response = client.get("/ai/weather-insights")
    assert response.status_code == 422
