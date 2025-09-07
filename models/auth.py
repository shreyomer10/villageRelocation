from pydantic import BaseModel, Field
from bson import ObjectId
from enum import Enum


class User(BaseModel):
    sub: str = Field(alias="_id")  # MongoDB _id → sub
    email: str
    name: str
    role: str
    mobile: str

    @classmethod
    def from_mongo(cls, doc: dict):
        # Convert ObjectId to string for _id/sub
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return cls.model_validate(doc)



class AccessLevel(str, Enum):
    READ_WRITE_UPDATE = "RWU"
    READ_ONLY = "R"
    BLOCKED = "Blocked"


class Operator(BaseModel):
    sub: str = Field(alias="_id")  # MongoDB _id → sub
    email: str
    name: str
    role: str
    mobile: str
    access: AccessLevel   # restricted field

    @classmethod
    def from_mongo(cls, doc: dict):
        # Convert ObjectId to string for _id/sub
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return cls.model_validate(doc)