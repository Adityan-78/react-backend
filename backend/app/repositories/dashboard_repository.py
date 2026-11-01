from app.mock_data.dashboard import MOCK_DASHBOARDS


def get_summary(role: str) -> dict:
    return MOCK_DASHBOARDS[role].copy()
