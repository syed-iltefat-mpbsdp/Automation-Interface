from flask import Flask, jsonify, request, make_response, current_app
from extensions import db
from config import SQLALCHEMY_DATABASE_URI, change_db_uri, get_server_info
from sqlalchemy import text, create_engine
from flask_cors import CORS
from datetime import datetime, timezone
from utils import copy_test_cases, run_batch_file, dump_rows_to_excel
import os


DATABASE_URL = SQLALCHEMY_DATABASE_URI 

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL

db.init_app(app)
CORS(app)

@app.route("/")
def ping():
    return { "ok" : True }

@app.route("/command_to_excel", methods=["POST"])
def command_to_excel():
    data = request.get_json() or {}
    incident_number = data.get("incident_number")
    action = data.get("action")
    comments = data.get("comments") or ""
    notification = data.get("notification") or ""
    hazard = data.get("hazard") or ""
    caution_notes = data.get("caution_notes") or ""
    confidential = data.get("confidential") or ""
    output_file = data.get("output_file")
    sheet_name = data.get("sheet")

    print(output_file, sheet_name)

    # create payload
    rows = [{'LocalIncidentNumber':f'{incident_number}', 
            'Action':f'{action.upper()}',
            'Comments' : f'{comments}',
            'Notification': f'{notification.lower()}',
            'Hazard' : f'{hazard.lower()}',
            'Caution_notes':f'{caution_notes.lower()}',
            'Confidential':f'{confidential.lower()}'}]
    output_dir = os.path.join("static")
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, output_file)
    dump_result = dump_rows_to_excel(rows, output_file=output_file,sheet_name=sheet_name)

    if isinstance(dump_result, dict) and dump_result.get("error"):
        current_app.logger.error("dump_sql_to_excel: %s", dump_result["error"])
        return make_response(jsonify({"success": False, "error": dump_result["error"]}), 500)

    payload = {
        "success": True,
        "timestamp": dump_result.get("timestamp"),
        "rows": dump_result.get("rows"),
        "file": dump_result.get("file"),
        "sheet": dump_result.get("sheet"),
        "message": dump_result.get("message")
    }
    resp = make_response(jsonify(payload), 200)
    resp.headers["Content-Type"] = "application/json"
    return resp

@app.route("/dump_sql_to_excel", methods=["POST"])
def dump_sql_to_excel():
    data = request.get_json() or {}
    sql_query = data.get("query")
    excel_sheet = data.get("sheet")
    output_file = data.get("output_file")
    global DATABASE_URL

    if not sql_query:
        return make_response(jsonify({"error": "Missing query in body"}), 400)

    if not excel_sheet:
        excel_sheet = "default"

    if not output_file:
        dt = datetime.now()
        output_file = f"sql_dump_{dt}.xlsx"

    if "xlsx" not in output_file:
        output_file = output_file + ".xlsx"

    if isinstance(sql_query, dict) and "query" in sql_query:
        sql_query = sql_query.get("query")

    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as connection:
            sql = text(sql_query)
            result = connection.execute(sql)
            rows = [dict(row._mapping) for row in result]
            print(rows)

        output_dir = os.path.join("static")
        os.makedirs(output_dir, exist_ok=True)

        output_file = os.path.join(output_dir, output_file)
        dump_result = dump_rows_to_excel(rows, output_file, sheet_name=excel_sheet)

        if isinstance(dump_result, dict) and dump_result.get("error"):
            current_app.logger.error("dump_sql_to_excel: %s", dump_result["error"])
            return make_response(jsonify({"success": False, "error": dump_result["error"]}), 500)

        payload = {
            "success": True,
            "timestamp": dump_result.get("timestamp"),
            "rows": dump_result.get("rows"),
            "file": dump_result.get("file"),
            "sheet": dump_result.get("sheet"),
            "message": dump_result.get("message")
        }
        resp = make_response(jsonify(payload), 200)
        resp.headers["Content-Type"] = "application/json"
        return resp

    except Exception as e:
        current_app.logger.exception("dump_sql_to_excel failed")
        return make_response(jsonify({"success": False, "error": str(e)}), 500)

@app.route("/run_copy", methods=["GET"])
def run_copy():
    input_file = "CIP-Automation.xlsm"
    sheet_name = "QueryIncidents_Params"
    output_file = "static/output.xlsx"

    headers = [
    "CACCId",
    "ServiceId",
    "Case",
    "IncidentRefId",
    "UnitId",
    "FromDateTime",
    "ToDateTime",
    "Conditions"
    ]

    result = copy_test_cases(input_file, sheet_name, output_file, selected_headers=headers)

    if isinstance(result, dict) and result.get("error"):
        payload = {"success": False, "error": result["error"]}
        resp = make_response(jsonify(payload), 500)
        resp.headers["Content-Type"] = "application/json"
        return resp

    payload = {
        "success": True,
        "from": input_file,
        "to": output_file,
        "details": result if isinstance(result, dict) else None
    }
    resp = make_response(jsonify(payload), 200)
    resp.headers["Content-Type"] = "application/json"
    return resp

@app.route("/which_server", methods=["GET"])
def which_server():
    return jsonify({"server" : get_server_info()["DB_HOST"]}), 200

@app.route("/change_db", methods=["POST"])
def change_db():
    data = request.get_json()
    new_url = data.get("new_url")

    if not new_url:
        return jsonify({"error": "Missing new_url in request body"}), 400

    try:
        global DATABASE_URL
        DATABASE_URL = change_db_uri(new_url)
        app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL

        return jsonify({"message": "Database url updated successfully", "new_uri": new_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/query", methods=["POST"])
def run_query():
    data = request.get_json()
    sql_query = data.get("query")
    global DATABASE_URL
    server = get_server_info()
    print(DATABASE_URL)
    if not sql_query:
        return jsonify({"error": "Missing query in body"}), 400

    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as connection:
            sql = text(sql_query)
            result = connection.execute(sql)
            rows = [dict(row._mapping) for row in result]

        return jsonify({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "results": rows,
            "server_info": server
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/run_batch_script", methods=["GET", "POST"])
def run_batch_script():
    bat_file = ""
    if request.method == "POST":
        data = request.get_json()
        bat_file = data.get("filename")
    else:
        bat_file = "queryIncidentsV3.bat" # default file name
    
    result = run_batch_file(bat_file)

    if isinstance(result, dict) and result.get("error"):
        payload = {"success": False, "error": result["error"], **{k: v for k, v in result.items() if k != "error"}}
        current_app.logger.error("run_batch_script failed: %s", result.get("error"))
        resp = make_response(jsonify(payload), 500)
        resp.headers["Content-Type"] = "application/json"
        return resp

    payload = {"success": True}
    if isinstance(result, dict):
        payload.update(result)
    
    current_app.logger.info("run_batch_script succeeded: %s", payload.get("file", bat_file))
    resp = make_response(jsonify(payload), 200)
    resp.headers["Content-Type"] = "application/json"
    return resp

if __name__ == "__main__":
    with app.app_context():
        app.run(host='127.0.0.1', port=5000, debug=True)