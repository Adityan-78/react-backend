"""Generate a route-level readiness register from the live FastAPI OpenAPI map.

This script never connects to SQL Server. Every endpoint without an executed
integration test is deliberately marked BLOCKED / NOT VERIFIED.
"""
from __future__ import annotations

import os
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL",
    "mssql+pyodbc://report:report@localhost/report?driver=ODBC+Driver+18+for+SQL+Server",
)

from app.main import app  # noqa: E402


TAGS = {
    "Authentication": ("Users", "auth_service.login / get_current_user"),
    "Roles": ("Role", "user_service.list_roles"),
    "Users": ("Users, Role", "user_service.*"),
    "Employees": ("Employee, Users", "employee_service.*; task_service.list_tasks"),
    "Customers": ("Customer, Sales_Order", "customer_service.*; order_service.list_orders_for_customer"),
    "Products": ("Product, Inventory", "product_service.*"),
    "Inventory": ("Inventory, Product", "inventory_service.*"),
    "Sales Orders": ("Sales_Order, Customer", "order_service.*"),
    "Tasks": ("Customer_Task, Employee, Users", "task_service.*"),
    "Operational Issues": ("Operational_Issue, Employee, Users", "issue_service.*"),
    "Purchase Requests": ("Purchase_Request, Purchase_Request_Item, Product, Inventory", "purchase_service.*"),
    "Purchase Request Items": ("Purchase_Request_Item, Purchase_Request, Product", "purchase_service.*"),
    "Dashboard": ("Users, Role, Sales_Order, Customer, Inventory, Product, Customer_Task, Operational_Issue, Purchase_Request", "dashboard_service.*"),
    "Health": ("None", "health_check"),
}


def ref_name(schema: dict) -> str:
    if "$ref" in schema:
        return schema["$ref"].rsplit("/", 1)[-1]
    if "items" in schema:
        return f"list[{ref_name(schema['items'])}]"
    return schema.get("type", "unspecified")


def main() -> None:
    spec = app.openapi()
    paths = spec["paths"]
    rows = []
    for path, methods in sorted(paths.items()):
        for method, operation in sorted(methods.items()):
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            tag = (operation.get("tags") or ["Unknown"])[0]
            tables, service = TAGS.get(tag, ("Unknown", "Unknown"))
            request_body = operation.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema", {})
            responses = operation.get("responses", {})
            success = next((responses[k] for k in ("200", "201", "204") if k in responses), {})
            response_schema = success.get("content", {}).get("application/json", {}).get("schema", {})
            auth = "No" if path == "/health" or (path == "/api/v1/auth/login" and method == "post") else "Yes"
            tested = path == "/health" and method == "get"
            status = "TESTED" if tested else "BLOCKED / NOT VERIFIED"
            rows.append(
                f"| `{method.upper()}` | `{path}` | {operation.get('summary') or operation.get('operationId', '—')} | "
                f"{auth} | See `app/core/constants.py` and route dependencies; runtime checks pending | "
                f"`{ref_name(request_body) if request_body else 'None'}` | `{ref_name(response_schema) if response_schema else 'No JSON body'}` | "
                f"{tables} | `{service}` | {'Health response test' if tested else 'Not run'} | "
                f"Not verified | Not verified | {'Pass' if tested else 'Pending'} | {status} |"
            )

    operations = len(rows)
    distinct_paths = len(paths)
    report = f"""# API Production Readiness Report

Generated from `app.openapi()`; the script does not connect to SQL Server.

## Summary

- Distinct endpoint paths: **{distinct_paths}**
- Registered HTTP operations: **{operations}**
- Operations reviewed in route source: **{operations}**
- Operations with an executed endpoint test: **1**
- Operations passing an endpoint test: **1** (`GET /health`)
- Production-ready operations: **0**
- Blocked / not verified: **{operations - 1}**
- Known source defects: see findings below; all remaining operations are unverified.

## Operation register

| Method | Path | Purpose | Auth | Authorized roles | Request schema | Response schema | Tables | Service / repository | Tests executed | Security checks | Frontend | Test result | Readiness |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
{chr(10).join(rows)}

## Findings and verification limits

- SQL Server URL configuration is now required and restricted to `mssql+pyodbc`; no real `DATABASE_URL` or `.env` is available in this environment.
- SQL Server metadata (tables, columns, keys, foreign keys, constraints) and connectivity were not checked. Schema unchanged is **not verified**.
- No production records were used. Database-backed tests and failure/rollback checks were not run.
- Current Python is 3.10. The isolated venv dependency check passed; the global interpreter has unrelated package conflicts and was not modified.
- User/password mapping and response serialization issues found in source were corrected; DB-backed confirmation is pending.
- Existing frontend API client still targets `/api/v1` and has not been exercised against a running backend.
- Route consolidation to fewer than 20 distinct paths has not been implemented; the current registered surface remains {distinct_paths} paths.
- The legacy mock admin implementation is not registered by `api_router`, but its unmounted module remains in source and should be removed or explicitly isolated.
- `GET /health` passed its automated test. JWT and password helper tests passed, but they do not verify endpoint authentication behavior against a database.

## Test execution

`pytest -q -p no:cacheprovider tests`: **6 passed**. One Starlette/httpx deprecation warning was emitted. `python -m pip check`: **No broken requirements found** in the project venv.

## Final readiness

The project is **not production-ready**. The API, SQL Server schema compatibility, authorization matrix, business workflows, and frontend integration need real controlled integration testing. Do not promote any operation to `PRODUCTION-READY` until the corresponding verification is executed.
"""
    output = Path(__file__).resolve().parents[2] / "API_PRODUCTION_READINESS_REPORT.md"
    output.write_text(report, encoding="utf-8")
    print(f"Wrote {output}")
    print(f"{distinct_paths} paths; {operations} operations")


if __name__ == "__main__":
    main()
