
import datetime as dt
import logging

from flask import Flask, Blueprint, logging,request, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from pymongo import  ASCENDING, DESCENDING
from utils.helpers import make_response
from models.family import Family, FamilyCard
from config import JWT_EXPIRE_MIN, db
from models.maati import GuidelinesModel, AboutUsModel, ContactUsModel, FAQModel


core=db.core
maati_bp = Blueprint("maati",__name__)





@maati_bp.route("/guidelines", methods=["GET"])
def get_guidelines():
    try:
        doc = core.find_one({"_id": "guidelines"})
        if not doc:
            return make_response(True, "Guidelines not found", None, 404)

        validated = GuidelinesModel.from_mongo(doc)
        return make_response(False, "Guidelines fetched successfully", validated.model_dump(mode="json"), 200)

    except ValidationError as e:
        return make_response(True, "Validation error", e.errors(), 422)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", None, 500)


@maati_bp.route("/aboutUs", methods=["GET"])
def get_about_us():
    try:
        doc = core.find_one({"_id": "aboutUs"})
        if not doc:
            return make_response(True, "About Us not found", None, 404)

        validated = AboutUsModel.from_mongo(doc)
        return make_response(False, "About Us fetched successfully", validated.model_dump(mode="json"), 200)

    except ValidationError as e:
        return make_response(True, "Validation error", e.errors(), 422)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", None, 500)


@maati_bp.route("/contactUs", methods=["GET"])
def get_contact_us():
    try:
        doc = core.find_one({"_id": "contactUs"})
        if not doc:
            return make_response(True, "Contact Us not found", None, 404)

        validated = ContactUsModel.from_mongo(doc)
        return make_response(False, "Contact Us fetched successfully", validated.model_dump(mode="json"), 200)

    except ValidationError as e:
        return make_response(True, "Validation error", e.errors(), 422)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", None, 500)


@maati_bp.route("/faq", methods=["GET"])
def get_faq():
    try:
        doc = core.find_one({"_id": "faq"})
        if not doc:
            return make_response(True, "FAQ not found", None, 404)

        validated = FAQModel.from_mongo(doc)
        return make_response(False, "FAQ fetched successfully", validated.model_dump(mode="json"), 200)

    except ValidationError as e:
        return make_response(True, "Validation error", e.errors(), 422)
    except Exception as e:
        return make_response(True, f"Unexpected error: {str(e)}", None, 500)
