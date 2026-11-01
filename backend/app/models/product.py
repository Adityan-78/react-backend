"""Product and Inventory tables, matching the supplied SQL scripts."""
from datetime import date
from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, true, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models._helpers import today
from app.core.config import settings

class Product(Base):
    __tablename__ = "Product"
    product_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    unit_measure: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())

class Inventory(Base):
    __tablename__ = "Inventory"
    inventory_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("Product.product_id"), unique=True, nullable=False)
    quantity_in_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    last_updated: Mapped[date | None] = mapped_column(Date, default=today)
    product: Mapped[Product] = relationship(Product)

    # API-only threshold from configuration; this is NOT a database column.
    @property
    def reorder_level(self) -> int:
        return settings.low_stock_threshold
    @property
    def is_low_stock(self) -> bool:
        return self.quantity_in_stock <= settings.low_stock_threshold
    @property
    def product_name(self) -> str:
        return self.product.name
    @property
    def unit_measure(self) -> str | None:
        return self.product.unit_measure
