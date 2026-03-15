from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

from app.models.base import Base


class TickerInfo(Base):
    __tablename__ = "ticker_info"

    ticker: Mapped[str] = mapped_column(String(20), primary_key=True)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[object] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
