
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from pydantic import BaseModel, field_validator
from typing import List, Optional
import re


class MeetingInsert(BaseModel):
    villageId: str
    photos: Optional[List[str]] = None
    docs: Optional[List[str]] = None
    notes: Optional[str] = None
    venue: str
    time: str   # keep string for DB consistency
    attendees: List[str]
    heldBy: str

    # ✅ Validate time format (ISO-like: YYYY-MM-DDTHH:MM or HH:MM)
    @field_validator("time")
    @classmethod
    def validate_time(cls, v: str) -> str:
        pattern_full = r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$"
        pattern_simple = r"^\d{2}:\d{2}$"
        if not (re.match(pattern_full, v) or re.match(pattern_simple, v)):
            raise ValueError("time must be in 'YYYY-MM-DDTHH:MM' or 'HH:MM' format")
        return v

    # ✅ Validate attendees list is not empty
    @field_validator("attendees")
    @classmethod
    def validate_attendees(cls, v: List[str]) -> List[str]:
        if not v or len(v) == 0:
            raise ValueError("attendees list cannot be empty")
        return v

    # ✅ Validate heldBy (must be non-empty)
    @field_validator("heldBy")
    @classmethod
    def validate_held_by(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("heldBy cannot be empty")
        return v

    # ✅ Validate photos/docs as valid URLs (only if provided)
    @field_validator("photos", "docs")
    @classmethod
    def validate_urls(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        for url in v:
            if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                raise ValueError(f"Invalid URL: {url}")
        return v


class MeetingUpdate(BaseModel):
    villageId: Optional[str] = None
    photos: Optional[List[str]] = None
    docs: Optional[List[str]] = None
    notes: Optional[str] = None
    venue: Optional[str] = None
    time: Optional[str] = None
    attendees: Optional[List[str]] = None
    heldBy: Optional[str] = None  # usually required for auth, but optional here


    @field_validator("time")
    @classmethod
    def validate_time(cls, v: Optional[str]):
        if v is not None and " " not in v:
            raise ValueError("Time must include both date and time")
        return v

    @field_validator("attendees")
    @classmethod
    def validate_attendees(cls, v: Optional[List[str]]):
        if v is not None and not all(a.strip() for a in v):
            raise ValueError("All attendees must be valid non-empty strings")
        return v


class Meeting(MeetingInsert):
    meetingId: str