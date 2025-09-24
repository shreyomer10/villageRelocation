

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class UserInsert(BaseModel):
    email: str
    name: str
    role: str
    mobile: str
    villageId:str

    class Config:
        extra = "forbid"  
class UserUpdate(BaseModel):
    email: Optional[str]
    name: Optional[str]
    role: Optional[str]
    mobile: Optional[str]

    class Config:
        extra = "forbid"  

class UserInsert(UserInsert):
    userId:str



class AccessLevel(str, Enum):
    READ_WRITE_UPDATE = "RWU"
    READ_ONLY = "R"
    BLOCKED = "Blocked"