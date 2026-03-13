"""Pydantic response models for search endpoints.

GET /search/politicians — PoliticianSuggestion list
GET /search/tickers    — TickerSuggestion list
"""
import uuid

from pydantic import BaseModel


class PoliticianSuggestion(BaseModel):
    id: uuid.UUID
    full_name: str
    party: str | None
    chamber: str | None


class TickerSuggestion(BaseModel):
    ticker: str


class PoliticianSearchResponse(BaseModel):
    results: list[PoliticianSuggestion]


class TickerSearchResponse(BaseModel):
    results: list[TickerSuggestion]
