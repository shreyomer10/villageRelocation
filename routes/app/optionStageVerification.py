
import datetime as dt
import logging

from flask import Blueprint, logging,request, jsonify
from pydantic import ValidationError
from models.counters import get_next_plot_id, get_next_verification_id
from utils.helpers import make_response, validation_error_response
from config import  db

from pymongo import errors  

families = db.testing
options = db.options
option_verification_BP = Blueprint("optionsVerification",__name__)

