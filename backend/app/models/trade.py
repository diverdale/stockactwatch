import uuid

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

from app.models.base import Base


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    external_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    politician_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("politicians.id"),
        nullable=False,
    )
    ticker: Mapped[str] = mapped_column(String(10), nullable=False)
    # INGEST-03: asset_type is NOT NULL — normalizer always sets it before upsert
    asset_type: Mapped[str] = mapped_column(String, nullable=False)
    asset_description: Mapped[str | None] = mapped_column(String, nullable=True)
    transaction_type: Mapped[str] = mapped_column(String, nullable=False)
    # INGEST-05: separate columns for when trade occurred vs when filed
    trade_date: Mapped[object] = mapped_column(Date, nullable=False)
    disclosure_date: Mapped[object] = mapped_column(Date, nullable=False)
    # filing_lag_days is a GENERATED ALWAYS AS column — defined in migration only
    amount_range_raw: Mapped[str | None] = mapped_column(String, nullable=True)
    amount_lower: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount_upper: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # amount_midpoint is a GENERATED ALWAYS AS column — defined in migration only
    owner: Mapped[str] = mapped_column(
        String, nullable=False, default="Self", server_default=text("'Self'")
    )
    # INGEST-02: tracks amendment versions
    amendment_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    # LEGAL-02: set False for options to exclude from return calculations
    return_calculable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    source: Mapped[str] = mapped_column(String, nullable=False)  # "quiver" / "capitol_trades"
    suspicion_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suspicion_flags: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[object] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[object] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_trades_politician_id", "politician_id"),
        Index("ix_trades_ticker", "ticker"),
        Index("ix_trades_disclosure_date", "disclosure_date"),
        Index("ix_trades_asset_type", "asset_type"),
    )
