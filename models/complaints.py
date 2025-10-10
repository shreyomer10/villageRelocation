from enum import Enum, IntEnum
from pydantic import BaseModel, Field, HttpUrl, EmailStr
from typing import List, Optional


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

class Feedback(FeedbackInsert):
    feedbackId:str
    currentStatus:int=STATUS.PENDING
    insertedAt:str
    updatedAt:str
    statusHistory:List[StatusHistory]=Field(default_factory=list)
    