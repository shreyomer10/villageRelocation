
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from pydantic import BaseModel, field_validator
from typing import List, Optional
import re
from utils.helpers import s3_url_pattern


class MeetingInsert(BaseModel):
    villageId: str
    photos: Optional[List[str]] = None
    docs: Optional[List[str]] = None
    notes: Optional[str] = None
    venue: str
    time: str   # keep string for DB consistency
    attendees: List[str]
    heldBy: str


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


    @field_validator("photos", "docs")
    @classmethod
    def validate_urls(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        for url in v:
            # Check for both http/https and s3 schemas
            if not isinstance(url, str) or not (
                url.startswith(("http://", "https://")) or s3_url_pattern.match(url)
            ):
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


    @field_validator("attendees")
    @classmethod
    def validate_attendees(cls, v: Optional[List[str]]):
        if v is not None and not all(a.strip() for a in v):
            raise ValueError("All attendees must be valid non-empty strings")
        return v
    
    @field_validator("photos", "docs")
    @classmethod
    def validate_urls(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        for url in v:
            # Check for both http/https and s3 schemas
            if not isinstance(url, str) or not (
                url.startswith(("http://", "https://")) or s3_url_pattern.match(url)
            ):
                raise ValueError(f"Invalid URL: {url}")
        return v


class Meeting(MeetingInsert):
    meetingId: str