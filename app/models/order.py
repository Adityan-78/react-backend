"""Sales_Order and Sales_Order_Item tables."""
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import OrderStatus
from app.db.base import Base
from app.models._helpers import today
from app.models.customer import Customer
from app.models.product import Product


class SalesOrder(Base):
    __tablename__ = "Sales_Order"

    order_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("Customer.customer_id"), nullable=False)
    order_date: Mapped[date] = mapped_column(Date, default=today)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default=OrderStatus.PENDING,
        server_default=text(f"'{OrderStatus.PENDING}'"),
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    notes: Mapped[str | None] = mapped_column(String(500))

    customer: Mapped[Customer] = relationship(Customer)
    # Lines are owned by the order: removing a line from the list deletes it.
    items: Mapped[list["SalesOrderItem"]] = relationship(
        "SalesOrderItem", back_populates="order",
        cascade="all, delete-orphan", order_by="SalesOrderItem.order_item_id",
    )

    @property
    def customer_name(self) -> str:
        return self.customer.name


class SalesOrderItem(Base):
    """New table (see schema_additions.sql) - one row per product on an order."""

    __tablename__ = "Sales_Order_Item"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="CK_SalesOrderItem_quantity"),
        CheckConstraint("unit_price >= 0", name="CK_SalesOrderItem_price"),
    )

    order_item_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("Sales_Order.order_id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("Product.product_id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    order: Mapped[SalesOrder] = relationship(SalesOrder, back_populates="items")
    product: Mapped[Product] = relationship(Product)

    @property
    def product_name(self) -> str:
        return self.product.name

    @property
    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity
