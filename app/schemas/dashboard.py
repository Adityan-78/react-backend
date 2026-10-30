from pydantic import BaseModel


class DashboardSummary(BaseModel):
    user: dict
    metrics: dict
