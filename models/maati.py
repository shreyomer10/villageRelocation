from pydantic import BaseModel, HttpUrl, EmailStr
from typing import List, Optional


class GuidelinesModel(BaseModel):
    pdfLink: HttpUrl
    points: List[str]

    @classmethod
    def from_mongo(cls, doc: dict):
        # Remove _id if it exists in Mongo
        doc.pop("_id", None)
        return cls.model_validate(doc)


class AboutUsModel(BaseModel):
    title: str
    content: str
    image: Optional[HttpUrl] = None

    @classmethod
    def from_mongo(cls, doc: dict):
        doc.pop("_id", None)
        return cls.model_validate(doc)


class ContactUsModel(BaseModel):
    email: str
    phone: str
    address: str
    image: Optional[HttpUrl] = None

    @classmethod
    def from_mongo(cls, doc: dict):
        doc.pop("_id", None)
        return cls.model_validate(doc)


class FAQItem(BaseModel):
    question: str
    answer: str


class FAQModel(BaseModel):
    items: List[FAQItem]

    @classmethod
    def from_mongo(cls, doc: dict):
        doc.pop("_id", None)
        return cls.model_validate(doc)
