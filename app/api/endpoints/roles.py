from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_roles
from app.core.constants import Perm
from app.schemas.user import RoleOut
from app.services import user_service

router = APIRouter()


@router.get(
    "", response_model=list[RoleOut],
    dependencies=[Depends(require_roles(*Perm.ADMIN_ONLY))],
)
def list_roles(db: DbSession):
    """The fixed set of system roles (admin only)."""
    return user_service.list_roles(db)
