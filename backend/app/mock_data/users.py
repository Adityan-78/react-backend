from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()


def _user(user_id, name, email, password, role):
    return {
        "user_id": user_id,
        "name": name,
        "email": email,
        "hashed_password": _hasher.hash(password),
        "role": role,
        "is_active": True,
    }


# Local demo accounts only. Replace with database records before deployment.
USERS_BY_EMAIL = {
    "admin@demo.com": _user(1, "Demo Admin", "admin@demo.com", "Admin123!", "admin"),
    "manager@demo.com": _user(2, "Demo Manager", "manager@demo.com", "Manager123!", "manager"),
    "sales@demo.com": _user(3, "Sales Executive", "sales@demo.com", "Sales123!", "sales"),
    "inventory@demo.com": _user(4, "Inventory Executive", "inventory@demo.com", "Inventory123!", "inventory"),
    "employee@demo.com": _user(5, "Demo Employee", "employee@demo.com", "Employee123!", "employee"),
}
