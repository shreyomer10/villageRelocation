from datetime import timedelta
from email.mime.text import MIMEText
import smtplib
from flask import Blueprint, request, jsonify
from pydantic import ValidationError
from models.village import Logs
from utils.tokenAuth import auth_required
from models.complaints import STATUS, FeedbackInsert, Type, StatusHistory
from models.counters import get_next_feedback_id
from models.emp import UserRole
from utils.helpers import make_response, nowIST, str_to_ist_datetime, validation_error_response
from config import db, SENDER_EMAIL, APP_PASSWORD, OTP_EXPIRE_MIN
from utils.rate_limiting import limiter

# MongoDB collections
users = db.users
feedback = db.feedback
villages = db.villages
stages = db.stages
plots = db.plots
families = db.testing
logs =db.logs
feedback_bp = Blueprint("feedback", __name__)


def send_email_feedback(receiver_email: str, name: str, feedbackId: str, villageId: str, feedbackType: str, feedbackCategory: str):
    """Send confirmation email to the user after feedback submission."""

    sender_email = SENDER_EMAIL
    app_password = APP_PASSWORD

    now_dt = str_to_ist_datetime(nowIST())
    expires_dt = now_dt + timedelta(minutes=OTP_EXPIRE_MIN)
    expires_at = expires_dt.strftime("%Y-%m-%d %H:%M:%S")

    msg_body = f"""
    Dear {name},

    Thank you for submitting your {feedbackType.lower()} on the MAATI platform.

    Your feedback details are as follows:
    ---------------------------------------
    Feedback ID: {feedbackId}
    Village ID: {villageId}
    Category: {feedbackCategory.capitalize()}
    Type: {feedbackType.capitalize()}
    Submitted At: {now_dt.strftime("%Y-%m-%d %H:%M:%S")}
    ---------------------------------------

    Our team will review your feedback and take necessary action.
    You will receive further updates as the status changes.

    Best regards,
    MAATI Support Team
    """

    msg = MIMEText(msg_body)
    msg["Subject"] = f"MAATI | {feedbackType.capitalize()} Submitted Successfully"
    msg["From"] = sender_email
    msg["To"] = receiver_email

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender_email, app_password)
            server.sendmail(sender_email, receiver_email, msg.as_string())
    except Exception as e:
        print(f"Error sending email: {e}")  # log only, don't fail the request


@feedback_bp.route("/feedback", methods=["POST"])
@limiter.limit("1 per minute")
def insert_feedback():
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, message="Missing request body", result=None, status=400)

        try:
            validated = FeedbackInsert(**payload)
        except ValidationError as ve:
            return validation_error_response(ve)

        # ✅ Validate village existence
        village = villages.find_one({"villageId": validated.villageId}, {"_id": 1})
        if not village:
            return make_response(True, message="Invalid or deleted villageId", result={"villageId": validated.villageId}, status=400)

        # ✅ Validate type-specific IDs
        if validated.type == Type.PLOT:
            if not validated.plotId:
                return make_response(True, "Missing parameter: plotId required for type 'plot'", result=None, status=400)
            plot = plots.find_one({"plotId": validated.plotId, "deleted": False}, {"_id": 1})
            if not plot:
                return make_response(True, "Invalid or deleted plotId", result={"plotId": validated.plotId}, status=400)

        elif validated.type == Type.FAMILY:
            if not validated.familyId:
                return make_response(True, "Missing parameter: familyId required for type 'family'", result=None, status=400)
            fam = families.find_one({"familyId": validated.familyId}, {"_id": 1})
            if not fam:
                return make_response(True, "Invalid or deleted familyId", result={"familyId": validated.familyId}, status=400)

        # ✅ Create feedback document
        feedbackId = get_next_feedback_id(validated.feedbackType,db=db)
        now = nowIST()
        status_history = StatusHistory(status=STATUS.PENDING, comments=f"Submitted by {validated.name}", time=now, verifier="")

        doc = {
            **validated.dict(),
            "feedbackId": feedbackId,
            "insertedAt": now,
            "updatedAt": now,
            "statusHistory": [status_history.dict()],
        }

        feedback.insert_one(doc)

        # ✅ Send email confirmation (non-blocking best practice)
        # send_email_feedback(
        #     receiver_email=validated.email,
        #     name=validated.name,
        #     feedbackCategory=validated.type,
        #     feedbackType=validated.feedbackType,
        #     villageId=validated.villageId,
        #     feedbackId=feedbackId
        # )

        return make_response(
            False,
            message="Feedback submitted successfully",
            result={"feedbackId": feedbackId, "villageId": validated.villageId, "feedbackType": validated.feedbackType},
            status=201
        )

    except Exception as e:
        return make_response(True, message=f"Error while inserting feedback: {str(e)}", result=None, status=500)


@feedback_bp.route("/feedback/<feedbackId>/action", methods=["PUT"])
@auth_required
def take_action(decoded_data,feedbackId):
    try:
        payload = request.get_json(force=True)
        if not payload:
            return make_response(True, message="Missing request body", result=None, status=400)

        status = payload.get("status")
        comments = payload.get("comments")
        verifier = payload.get("verifier")
        userId = payload.get("userId")

        user_id = decoded_data.get("userId")
        user_role=decoded_data.get("role")
        activated=bool(decoded_data.get("activated"))
        #print(activated)



        if not user_id or not user_role:
            return make_response(True, "Invalid token: missing userId", status=400)
        if user_id!=userId:
            return make_response(True, "Unauthorized access", status=403)
        if not activated:
            return make_response(True, "User is not activated. Contact DD", status=400)

        if status not in [s.value for s in STATUS]:
            return make_response(True, "Invalid parameter: status", result={"status": status}, status=400)
        if not comments or not verifier:
            return make_response(True, "Missing parameters: comments and verifier are required", result=None, status=400)

        fb = feedback.find_one({"feedbackId": feedbackId})
        if not fb:
            return make_response(True, "Feedback not found", result={"feedbackId": feedbackId}, status=404)
        villageId=fb.get("villageId")
        now = nowIST()
        status_history = StatusHistory(status=status, comments=comments, time=now, verifier=verifier)

        feedback.update_one(
            {"feedbackId": feedbackId},
            {
                "$set": {"currentStatus": status, "updatedAt": now},
                "$push": {"statusHistory": status_history.dict()},
            },
        )
        log=Logs(
            userId=userId,
            updateTime=now,
            type='Feedback',
            action='Action',
            comments=comments,
            relatedId=feedbackId,
            villageId=villageId
        )

        # Insert into DB
        logs.insert_one(log.model_dump())
        return make_response(False, "Feedback status updated successfully", result={"feedbackId": feedbackId, "newStatus": status}, status=200)

    except Exception as e:
        return make_response(True, message=f"Error while updating feedback: {str(e)}", result=None, status=500)


@feedback_bp.route("/feedbacks/<villageId>", methods=["GET"])
@auth_required
def get_all_feedbacks(decoded_data,villageId):
    try:
        args = request.args

        query = {}
        
        familyId = args.get("familyId")
        plotId = args.get("plotId")
        feedbackType = args.get("feedbackType")
        name = args.get("name")

        from_date = args.get("fromDate")
        to_date = args.get("toDate")
        page = int(args.get("page", 1))
        limit = int(args.get("limit", 15))
        query = {"villageId":villageId}

        if name:
            query["name"] = {"$regex": name, "$options": "i"}
        if familyId:
            query["familyId"] = familyId
        if plotId:
            query["plotId"] = plotId
        if feedbackType:
            query["feedbackType"] = feedbackType

        # --- Date Range Filtering ---
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = (from_date)
            if to_date:
                date_filter["$lte"] = (to_date)
            query["insertedAt"] = date_filter

        # --- Projection (exclude heavy fields) ---
        projection = {"_id": 0, "statusHistory": 0, "docs": 0}

        # --- Sorting & Pagination ---
        skip = (page - 1) * limit

        cursor = (
            feedback.find(query, projection)
            .sort("insertedAt", -1)  # latest first
            .skip(skip)
            .limit(limit)
        )

        verifications = list(cursor)
        total_count = feedback.count_documents(query)

        if not verifications:
            return make_response(
                True,
                "No feedbacks found",
                result={"count": 0, "items": []},
                status=404,
            )

        return make_response(
            False,
            "feedbacks fetched successfully",
            result={
                "count": total_count,
                "page": page,
                "limit": limit,
                "items": verifications,
            },
        )

    except ValueError as ve:
        return make_response(
            True,
            f"Invalid date format: {str(ve)}",
            result={"count": 0, "items": []},
            status=400,
        )

    except Exception as e:
        return make_response(
            True,
            f"Error fetching feedback: {str(e)}",
            result={"count": 0, "items": []},
            status=500,
        )

@feedback_bp.route("/feedback/<feedbackId>", methods=["GET"])
@limiter.limit("1 per minute")
def get_feedback(feedbackId):
    try:
        if not feedbackId:
            return make_response(True, message="Missing parameter: feedbackId", result=None, status=400)

        fb = feedback.find_one({"feedbackId": feedbackId}, {"_id": 0})
        if not fb:
            return make_response(True, message="Feedback not found", result={"feedbackId": feedbackId}, status=404)

        return make_response(False, "Feedback fetched successfully", result={"feedback": fb}, status=200)

    except Exception as e:
        return make_response(True, message=f"Error fetching feedback: {str(e)}", result=None, status=500)
