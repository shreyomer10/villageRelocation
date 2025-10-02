import os
import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
JWT_SECRET = os.getenv("JWT_SECRET")
DB_NAME = os.getenv("DB_NAME")
JWT_EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MIN", "120"))
OTP_EXPIRE_MIN = int(os.getenv("OTP_EXPIRE_MIN", "1"))
SENDER_EMAIL=os.getenv("SENDER_EMAIL",default="shreyomer41@gmail.com")
RECIEVER_EMAIL=os.getenv("RECIEVER_EMAIL",default="luckyomer10@gmail.com")
APP_PASSWORD=os.getenv("APP_PASSWORD")
client = MongoClient(
    MONGO_URI,
    tls=True,
    tlsCAFile=certifi.where()
)

db = client[DB_NAME]
