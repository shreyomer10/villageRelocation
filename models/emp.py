

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    ADMIN = "admin"
    forestguard = "fg"
    rangeAssistant = "ra"
    rangeOfficer = "ro"
    assistantDirector="ad"
    deputyDirector="dd"


class UserInsert(BaseModel):
    email: str
    name: str
    role: UserRole
    mobile: str
    villageID:List[str]= Field(default_factory=list)
    activated:Optional[bool]=True
    deleted:Optional[bool]=False

    class Config:
        extra = "forbid"  


class UserUpdate(BaseModel):
    email:  Optional[str]=None
    name:  Optional[str]=None
    #role: UserRole
    mobile:  Optional[str]=None
    villageID:Optional[List[str]]= None
    activated:Optional[bool]=False
    deleted:Optional[bool]=False

    class Config:
        extra = "forbid"  

class Users(UserInsert):
    userId:str
    password:str
    verified:bool
    
    @classmethod
    def from_mongo(cls, doc: dict):
        if not doc:
            return None
        # remove _id if present
        doc.pop("_id", None)
        return cls.parse_obj(doc)   # validates against schema