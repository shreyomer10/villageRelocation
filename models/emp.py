

from enum import Enum
from typing import Optional
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
    password:Optional[str]=None
    villageId:str
    range: Optional[str]=None
    sd1: Optional[str]=None
    fd: Optional[str]=None
    gramPanchayat: Optional[str]=None
    tehsil: Optional[str]=None
    janpad: Optional[str]=None
    subD2: Optional[str]=None
    district: Optional[str]=None
    activated:Optional[bool]=False
    deleted:Optional[bool]=False

    class Config:
        extra = "forbid"  


class UserUpdate(BaseModel):
    email:  Optional[str]=None
    name:  Optional[str]=None
    #role: UserRole
    mobile:  Optional[str]=None
    password: Optional[str]=None
    villageId: Optional[str]=None
    range: Optional[str]=None
    sd1: Optional[str]=None
    fd: Optional[str]=None
    gramPanchayat: Optional[str]=None
    tehsil: Optional[str]=None
    janpad: Optional[str]=None
    subD2: Optional[str]=None
    district: Optional[str]=None
    activated:Optional[bool]=False
    deleted:Optional[bool]=False


class Users(UserInsert):
    userId:str
    password:str
    
