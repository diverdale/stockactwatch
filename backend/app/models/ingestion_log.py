import uuid

from sqlalchemy import Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TIMESTAMP

from app.models.base import Base


class IngestionLog(Base):
    __tablename__ = "ingestion_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    source: Mapped[str] = mapped_column(String, nullable=False)
    started_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    finished_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    trades_fetched: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trades_upserted: Mapped[int | None] = mapped_column(Integer, nullable=True)
    errors: Mapped[object] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)  # "success" / "partial" / "failed"
