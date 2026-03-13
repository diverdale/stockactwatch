from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

from app.models.base import Base


class TickerMeta(Base):
    __tablename__ = "ticker_meta"

    ticker: Mapped[str] = mapped_column(String(20), primary_key=True)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sector_slug: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quote_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    updated_at: Mapped[object] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
