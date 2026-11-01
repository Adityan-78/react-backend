"""Safe local test configuration; no application database is contacted."""
import os

os.environ.setdefault(
    "DATABASE_URL",
    "mssql+pyodbc://unit:unit@localhost/unit?driver=ODBC+Driver+18+for+SQL+Server",
)
