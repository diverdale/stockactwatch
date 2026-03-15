from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PoliticianCommittee(Base):
    __tablename__ = "politician_committees"
    __table_args__ = (UniqueConstraint("politician_id", "committee_code", name="uq_politician_committee"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default="gen_random_uuid()")
    politician_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False
    )
    committee_code: Mapped[str] = mapped_column(String(20), nullable=False)
    committee_name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    chamber: Mapped[str] = mapped_column(String(10), nullable=False)
