from app.repositories.dashboard_repository import get_summary


def get_dashboard_summary(user: dict) -> dict:
    # The repository is mock-backed today. Later, fetch real data using
    # the authenticated user's ID and role, preserving this response shape.
    return {
        "user": {"name": user["name"], "role": user["role"]},
        "metrics": get_summary(user["role"]),
    }
