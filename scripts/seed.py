"""Create the five roles and a first administrator account.

Usage (from the project root):
    python -m scripts.seed --email admin@example.com --name "System Admin"
        -> prompts for the password (nothing is hard-coded, nothing is echoed)

    python -m scripts.seed --create-tables ...
        -> also runs create_all(). Use that ONLY for a throw-away local
           database such as SQLite (DATABASE_URL=sqlite:///./dev.db).
           For SQL Server run sql/schema_additions.sql instead.
"""
import argparse
import getpass
import sys

from sqlalchemy import select

from app.core.constants import Roles
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_engine, _session_factory
from app.models import Employee, Role, User
from app.schemas.common import validate_password_strength

ROLE_DESCRIPTIONS = {
    Roles.ADMIN: "Manages users, roles and oversees the whole system",
    Roles.MANAGER: "Assigns tasks, approves purchase requests, monitors operations",
    Roles.SALES: "Manages customers and sales orders",
    Roles.INVENTORY: "Manages products, stock and purchase requests",
    Roles.EMPLOYEE: "Views tasks, updates progress, raises issues",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="System Admin")
    parser.add_argument("--create-tables", action="store_true")
    args = parser.parse_args()

    password = getpass.getpass("Admin password: ")
    try:
        validate_password_strength(password)
    except ValueError as exc:
        print(f"Invalid password: {exc}")
        return 1

    if args.create_tables:
        Base.metadata.create_all(get_engine())

    with _session_factory()() as db:
        # Roles: add whichever are missing.
        existing = set(db.scalars(select(Role.role_name)))
        for name in Roles.ALL:
            if name not in existing:
                db.add(Role(role_name=name, description=ROLE_DESCRIPTIONS[name]))
        db.flush()

        email = args.email.strip().lower()
        if db.scalar(select(User).where(User.email == email)):
            print(f"User {email} already exists - nothing to do.")
            db.commit()
            return 0

        admin_role = db.scalar(select(Role).where(Role.role_name == Roles.ADMIN))
        user = User(
            role_id=admin_role.role_id, name=args.name, email=email,
            password_hash=hash_password(password),
        )
        db.add(user)
        db.flush()
        db.add(Employee(user_id=user.user_id, designation="Administrator", department="IT"))
        db.commit()
        print(f"Created admin {email}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
