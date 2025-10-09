
import datetime as dt
import logging

from flask import Flask, Blueprint, logging,request, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from models.counters import get_next_family_id, get_next_family_update_id, get_next_member_update_id
from utils.helpers import make_response, validation_error_response
from models.family import Family, FamilyCard, FamilyComplete, FamilyUpdate, Member, StatusHistory, Updates, UpdatesInsert, UpdatesUpdate
from config import JWT_EXPIRE_MIN, db

from pymongo import errors  

users = db.users
suggestions=db.suggestions
villages = db.villages
stages = db.stages

families = db.testing
suggestions_bp = Blueprint("suggestions",__name__)

