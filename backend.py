
import datetime as dt

from flask import Flask, Blueprint,request, jsonify,make_response
from flask_cors import CORS
from config import JWT_EXPIRE_MIN, db
from routes.auth import auth_bp
from routes.village import village_bp
from routes.family import family_bp
from routes.maati import maati_bp
from routes.meeting import meeting_bp
from routes.admin.community import building_bp
from routes.document import s3_bp

from routes.app.plotsVerification import plots_BP
from routes.app.optionStageVerification import option_verification_BP
from routes.options import options_BP
from routes.admin.villageStages import villageStages_BP
from routes.admin.employee import emp_bp
from routes.admin.analytics import analytics_BP
from routes.complaints import feedback_bp
app = Flask(__name__)
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
app.register_blueprint(plots_BP,url_prefix="/")
app.register_blueprint(options_BP,url_prefix="/")
app.register_blueprint(emp_bp,url_prefix="/")
app.register_blueprint(villageStages_BP,url_prefix="/")
app.register_blueprint(option_verification_BP,url_prefix="/")
app.register_blueprint(analytics_BP,url_prefix="/")
app.register_blueprint(s3_bp,url_prefix="/")
app.register_blueprint(feedback_bp,url_prefix="/")


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

