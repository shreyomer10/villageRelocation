import logging
from flask import Blueprint
from pydantic import ValidationError
from utils.helpers import make_response
from config import db
from models.maati import (
    GuidelinesModel,
    AboutUsModel,
    ContactUsModel,
    FAQModel,
    PrivacyPolicyModel
)

logger = logging.getLogger(__name__)

core = db.core
maati_bp = Blueprint("maati", __name__, url_prefix="/api/v1/maati")

PAGE_REGISTRY = {
    "guidelines": GuidelinesModel,
    "about-us": AboutUsModel,
    "contact-us": ContactUsModel,
    "faq": FAQModel,
    "privacy-policy": PrivacyPolicyModel,
}


@maati_bp.route("/<page_key>", methods=["GET"])
def get_static_page(page_key):
    try:
        model = PAGE_REGISTRY.get(page_key)
        if not model:
            return make_response(True, "Invalid page", None, 404)

        doc = core.find_one({"_id": page_key})
        if not doc:
            return make_response(True, "Content not found", None, 404)

        data = model.from_mongo(doc)

        return make_response(
            False,
            "Success",
            data.model_dump(mode="json"),  # 🔥 THIS FIX
            200
        )

    except ValidationError as e:
        return make_response(True, "Validation error", e.errors(), 422)

    except Exception as e:
        return make_response(True, str(e), None, 500)
