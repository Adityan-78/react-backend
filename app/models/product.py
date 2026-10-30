"""Product and Inventory tables."""
from datetime import date

from sqlalchemy import (
    Boolean, CheckConstraint, Date, ForeignKey, Integer, String, true, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models._helpers import today


class Product(Base):
    __tablename__ = "Product"

    product_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    unit_measure: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )


class Inventory(Base):
    __tablename__ = "Inventory"
    __table_args__ = (
        CheckConstraint("quantity_in_stock >= 0", name="CK_Inventory_quantity"),
        CheckConstraint("reorder_level >= 0", name="CK_Inventory_reorder"),
    )

    inventory_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("Product.product_id"), unique=True, nullable=False
    )
    quantity_in_stock: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    # Needed for low-stock alerts (see schema_additions.sql).
    reorder_level: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    last_updated: Mapped[date | None] = mapped_column(Date, default=today)

    product: Mapped[Product] = relationship(Product)

    @property
    def is_low_stock(self) -> bool:
        return self.quantity_in_stock <= self.reorder_level

    @property
    def product_name(self) -> str:
        return self.product.name

    @property
    def unit_measure(self) -> str | None:
        return self.product.unit_measure
