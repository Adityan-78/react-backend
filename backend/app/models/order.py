"""Sales_Order table. The supplied schema has no order-line table."""
from datetime import date
from decimal import Decimal
from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.constants import OrderStatus
from app.db.base import Base
from app.models._helpers import today
from app.models.customer import Customer

class SalesOrder(Base):
    __tablename__ = "Sales_Order"
    order_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("Customer.customer_id"), nullable=False)
    order_date: Mapped[date] = mapped_column(Date, nullable=False, default=today)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default=OrderStatus.PENDING, server_default=text("'Pending'"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default=text("0"))
    notes: Mapped[str | None] = mapped_column(String(500))
    customer: Mapped[Customer] = relationship(Customer)
    @property
    def customer_name(self) -> str: return self.customer.name
