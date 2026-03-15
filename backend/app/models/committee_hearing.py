from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CommitteeHearing(Base):
    __tablename__ = "committee_hearings"
    __table_args__ = (UniqueConstraint("committee_code", "event_id", name="uq_committee_hearing_code_event"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default="gen_random_uuid()")
    committee_code: Mapped[str] = mapped_column(String(20), nullable=False)
    committee_name: Mapped[str] = mapped_column(Text, nullable=False)
    hearing_date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    meeting_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    congress: Mapped[int] = mapped_column(Integer, nullable=False)
    event_id: Mapped[str] = mapped_column(String(50), nullable=False)
