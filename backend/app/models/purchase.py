"""Purchase_Request and Purchase_Request_Item tables."""
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ApprovalStatus, PRStatus
from app.db.base import Base
from app.models._helpers import today
from app.models.product import Product
from app.models.user import Employee


class PurchaseRequest(Base):
    __tablename__ = "Purchase_Request"

    pr_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    raised_by: Mapped[int] = mapped_column(ForeignKey("Employee.employee_id"), nullable=False)
    request_date: Mapped[date] = mapped_column(Date, default=today)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default=PRStatus.SUBMITTED,
        server_default=text(f"'{PRStatus.SUBMITTED}'"),
    )
    approval_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default=ApprovalStatus.PENDING,
        server_default=text(f"'{ApprovalStatus.PENDING}'"),
    )

    requester: Mapped[Employee] = relationship(Employee)
    items: Mapped[list["PurchaseRequestItem"]] = relationship(
        "PurchaseRequestItem", back_populates="request",
        cascade="all, delete-orphan", order_by="PurchaseRequestItem.pr_item_id",
    )

    @property
    def raised_by_name(self) -> str:
        return self.requester.user.name

    @property
    def total_estimated(self) -> Decimal:
        return sum(
            ((i.estimated_price or Decimal("0")) * i.quantity for i in self.items),
            Decimal("0.00"),
        )


class PurchaseRequestItem(Base):
    __tablename__ = "Purchase_Request_Item"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="CK_PRItem_quantity"),
    )

    pr_item_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pr_id: Mapped[int] = mapped_column(ForeignKey("Purchase_Request.pr_id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("Product.product_id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(String(500))
    # The approver (an employee). Approval is decided for the whole request,
    # and copied onto every item so the two always agree.
    approval_id: Mapped[int | None] = mapped_column(ForeignKey("Employee.employee_id"))
    approved_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default=ApprovalStatus.PENDING,
        server_default=text(f"'{ApprovalStatus.PENDING}'"),
    )

    request: Mapped[PurchaseRequest] = relationship(PurchaseRequest, back_populates="items")
    product: Mapped[Product] = relationship(Product)

    @property
    def product_name(self) -> str:
        return self.product.name
