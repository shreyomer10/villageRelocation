import datetime as dt
from flask import Flask, Blueprint, logging,request, jsonify,make_response
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from models.village import FamilyCount, SubStage, Village, VillageCard
from config import JWT_EXPIRE_MIN, db

import logging

users = db.users
villages = db.villages

emp_bp = Blueprint("emp",__name__)

