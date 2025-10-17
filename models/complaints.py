from enum import Enum, IntEnum
from pydantic import BaseModel, Field, HttpUrl, EmailStr, field_validator
from typing import List, Optional
from utils.helpers import s3_url_pattern


class StatusHistory(BaseModel):
    status:int
    comments:str
    verifier:str
    time: str          # ISO timestamp

class Type(str, Enum):
    PLOT = "plot"                                 
    FAMILY = "family"                             
    VILLAGE="village"                             
    OTHERS="others"                               

class STATUS(IntEnum):
    REJECTED = -1
    PENDING = 0
    RESOLVED = 1
class COMPLAINTorSUGGESTION(str, Enum):
    COMPLAINT = "complaint"                       #COMPLAINT
    SUGGESTION = "suggestion"                   #suggestion

class FeedbackInsert(BaseModel):
    feedbackType:COMPLAINTorSUGGESTION
    type:Type
    name:str
    mobile:str
    email:str
    villageId:str
    familyId:Optional[str]
    plotId:Optional[str]
    comments:str
    docs:List[str]=Field(default_factory=list)

    @field_validator("docs")
    @classmethod
    def validate_urls(cls, v: List[str]) -> List[str]:
        if v is []:
            return v
        for url in v:
            # Check for both http/https and s3 schemas
            if not isinstance(url, str) or not (
                url.startswith(("http://", "https://")) or s3_url_pattern.match(url)
            ):
                raise ValueError(f"Invalid URL: {url}")
        return v    

class Feedback(FeedbackInsert):
    feedbackId:str
    currentStatus:int=STATUS.PENDING
    insertedAt:str
    updatedAt:str
    statusHistory:List[StatusHistory]=Field(default_factory=list)
    