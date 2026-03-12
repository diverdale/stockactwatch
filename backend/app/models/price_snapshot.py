import uuid

from sqlalchemy import Date, Index, Numeric, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    ticker: Mapped[str] = mapped_column(String(10), nullable=False)
    snapshot_date: Mapped[object] = mapped_column(Date, nullable=False)
    close_price: Mapped[object] = mapped_column(Numeric(12, 4), nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)  # "fmp" / "yfinance"

    __table_args__ = (
        UniqueConstraint("ticker", "snapshot_date", name="uq_price_snapshots_ticker_date"),
        Index("ix_price_snapshots_ticker", "ticker"),
    )
