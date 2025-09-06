from pydantic import BaseModel, Field
from bson import ObjectId

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
