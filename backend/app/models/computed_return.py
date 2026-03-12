import uuid

from sqlalchemy import Date, ForeignKey, Index, Integer, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

from app.models.base import Base


class ComputedReturn(Base):
    __tablename__ = "computed_returns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    # One return per trade
    trade_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trades.id"),
        unique=True,
        nullable=False,
    )
    politician_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("politicians.id"),
        nullable=False,
    )
    ticker: Mapped[str] = mapped_column(String(10), nullable=False)
    trade_date: Mapped[object] = mapped_column(Date, nullable=False)
    price_at_trade: Mapped[object] = mapped_column(Numeric(12, 4), nullable=True)
    price_current: Mapped[object] = mapped_column(Numeric(12, 4), nullable=True)
    return_pct: Mapped[object] = mapped_column(Numeric(10, 4), nullable=True)
    return_dollar_est: Mapped[object] = mapped_column(Numeric(14, 2), nullable=True)
    sp500_return_pct: Mapped[object] = mapped_column(Numeric(10, 4), nullable=True)
    methodology_ver: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    computed_at: Mapped[object] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_computed_returns_politician_id", "politician_id"),
        Index("ix_computed_returns_ticker", "ticker"),
    )
