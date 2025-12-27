
import datetime as dt

from flask import Flask, Blueprint,request, jsonify
from flask_cors import CORS
from flask_limiter import RateLimitExceeded
from utils.helpers import make_response
from config import JWT_EXPIRE_MIN, db
from routes.auth import auth_bp
from routes.village import village_bp
from routes.family import family_bp
from routes.maati import maati_bp
from routes.meeting import meeting_bp
from routes.admin.community import building_bp
from routes.document import s3_bp

from routes.app.plotsVerification import plots_verification_BP
from routes.app.plots import plots_BP

from routes.app.optionStageVerification import option_verification_BP
from routes.options import options_BP
from routes.admin.villageStages import villageStages_BP
from routes.admin.employee import emp_bp
from routes.admin.admin import admin_BP

from routes.admin.analytics import analytics_BP
from routes.complaints import feedback_bp
from routes.admin.material import materials_bp
from routes.admin.facilities import facilities_bp
from routes.app.facilityVerification import facility_verifications_bp
from routes.app.materialUpdates import material_updates_bp
from routes.admin.facilities import facilities_bp
from utils.rate_limiting import limiter
from routes.logs import logs_bp
from datetime import datetime

app = Flask(__name__)
limiter.init_app(app)

CORS(app,
     supports_credentials=True,
     resources={
         r"/*": {
             "origins": [
                 "http://localhost:5173",
                 "https://villagerelocation-kkot.onrender.com"
             ]
         }
     })




users = db.users
villages = db.villages
stages = db.stages
families = db.families
core = db.core

app.register_blueprint(auth_bp,url_prefix="/")
app.register_blueprint(village_bp,url_prefix="/")
app.register_blueprint(family_bp,url_prefix="/")
app.register_blueprint(maati_bp,url_prefix="/")
app.register_blueprint(meeting_bp,url_prefix="/")
app.register_blueprint(building_bp,url_prefix="/")
app.register_blueprint(plots_verification_BP,url_prefix="/")
app.register_blueprint(plots_BP,url_prefix="/")

app.register_blueprint(options_BP,url_prefix="/")
app.register_blueprint(emp_bp,url_prefix="/")
app.register_blueprint(villageStages_BP,url_prefix="/")
app.register_blueprint(option_verification_BP,url_prefix="/")
app.register_blueprint(analytics_BP,url_prefix="/")
app.register_blueprint(s3_bp,url_prefix="/")
app.register_blueprint(feedback_bp,url_prefix="/")
app.register_blueprint(materials_bp,url_prefix="/")
app.register_blueprint(material_updates_bp,url_prefix="/")
app.register_blueprint(facility_verifications_bp,url_prefix="/")
app.register_blueprint(facilities_bp,url_prefix="/")
app.register_blueprint(admin_BP,url_prefix="/admin")
app.register_blueprint(logs_bp,url_prefix="/")


@app.errorhandler(RateLimitExceeded)
def ratelimit_handler(e):


    return make_response(
        True,
        message=f"Too many requests — please wait seconds before retrying.",
        status=429
    )




@app.route("/", methods=["GET"])
def home():
    
    """
    Village Relocation Management System API Documentation
    Complete API reference with all endpoints, parameters, and responses
    """
    api_docs={"will update the link": "soon"}

    return jsonify(api_docs)

if __name__ == "__main__":
    app.run(debug=True)

