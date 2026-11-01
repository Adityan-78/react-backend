"""Import all ORM models so SQLAlchemy registers the existing tables."""
from app.models.customer import Customer
from app.models.issue import OperationalIssue
from app.models.order import SalesOrder
from app.models.product import Inventory, Product
from app.models.purchase import PurchaseRequest, PurchaseRequestItem
from app.models.task import CustomerTask
from app.models.user import Employee, Role, User

__all__ = ["Role", "User", "Employee", "Customer", "Product", "Inventory", "SalesOrder", "CustomerTask", "OperationalIssue", "PurchaseRequest", "PurchaseRequestItem"]
