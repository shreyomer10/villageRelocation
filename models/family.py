from pydantic import BaseModel, HttpUrl
from typing import Optional, List




class FamilyCard(BaseModel):
    familyId:str
    mukhiyaName:str
    mukhiyaPhoto:HttpUrl
    relocationOption:int

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)

class Members(BaseModel):
    name:str
    age:str
    healthStatus:str
    photo:HttpUrl
   # relocationOption:int   #new

class Family(BaseModel):
    familyId:str
    mukhiyaName:str
    mukhiyaPhoto:HttpUrl
    relocationOption:int
    villageId:str
    mukhiyaHealth:str
    mukhiyaAge:str
    updatedAt:str
    updatedBy:str
   # lat:float   #new
   # long:float   #new
    members:List[Members]=[]
    photos:List[HttpUrl]=[]
    docs:List[HttpUrl]=[]


    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)