from typing import Annotated
from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.services.dashboard_service import get_dashboard_summary
from app.schemas.dashboard import DashboardSummary

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def summary(user: Annotated[dict, Depends(get_current_user)]):
    return get_dashboard_summary(user)
