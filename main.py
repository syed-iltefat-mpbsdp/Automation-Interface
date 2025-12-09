from flask import Flask, jsonify, request, make_response, current_app
from extensions import db
from config import SQLALCHEMY_DATABASE_URI, change_db_uri, get_server_info, read_config, change_db_info, PYTHON_SERVER_URL
from sqlalchemy import text, create_engine
from flask_cors import CORS
from datetime import datetime, timezone
from utils import copy_test_cases, run_batch_file, dump_rows_to_excel
import os
import sys
from pathlib import Path
from configparser import ConfigParser
from urllib.parse import urlparse

DATABASE_URL = SQLALCHEMY_DATABASE_URI 

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
CONFIG_PATH = Path("settings.config")

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
    output_dir = data.get("output_dir") or "static"
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
    
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / output_file

    print(output_path)
    dump_result = dump_rows_to_excel(rows, output_file=str(output_path),sheet_name=sheet_name)

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


        output_dir = Path("C:\\Users\\IltefaSy\\Downloads")
        output_dir.mkdir(parents=True, exist_ok=True)

        output_path = output_dir / output_file

        print(output_file)
        dump_result = dump_rows_to_excel(rows, str(output_path), sheet_name=excel_sheet)

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
        print(DATABASE_URL)
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

@app.route("/change_settings", methods=["POST"])
def change_settings():
    data = request.get_json(silent=True) or {}
    directory = data.get("directory")
    default_server = data.get("default_server")
    username = data.get("db_username")
    password = data.get("db_password")
    port = data.get("db_port")

    if not directory:
        return jsonify({"success": False, "error": "Missing 'directory'"}), 400

    new_dir_path = Path(directory).expanduser()

    if not new_dir_path.exists() or not new_dir_path.is_dir():
        return jsonify({"success": False, "error": "Directory does not exist"}), 400
    

    new_dir = str(new_dir_path)

    cfg = ConfigParser()
    cfg.read(CONFIG_PATH)

    # ensure the preferences section exists and set the keys you use in your config
    if not cfg.has_section("preferences"):
        cfg.add_section("preferences")
    cfg.set("preferences", "output_dir", new_dir)

    if default_server is not None and str(default_server).strip() != "":
        cfg.set("preferences", "default_server", str(default_server).strip())

    if username is not None and str(username).strip() != "":
        cfg.set("preferences", "db_username", str(username).strip())

    if password is not None and str(password) != "":
        # encrypt password (pending) 
        cfg.set("preferences", "db_password", str(password))

    if port is not None:
        cfg.set("preferences", "db_port", str(port))

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        cfg.write(f)

    resp = {"success": True, "output_dir": new_dir}
    if default_server is not None and str(default_server).strip() != "":
        resp["default_server"] = str(default_server).strip()

    global DATABASE_URL
    DATABASE_URL = change_db_info(user=username, password=password, port=port)
    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
    with app.app_context():
        db.session.remove()
        db.engine.dispose()

    return jsonify(resp), 200

@app.route("/change_python_url", methods=["POST"])
def chnage_python_url():
    data = request.get_json(silent=True) or {}

    python_server = data.get("python_server_url")
    
    if not python_server:
        return jsonify({"success": False, "error": "No python server url given"}), 400

    cfg = ConfigParser()
    cfg.read(CONFIG_PATH)

    # ensure the preferences section exists and set the keys you use in your config
    if not cfg.has_section("preferences"):
        cfg.add_section("preferences")

    if python_server is not None:
        cfg.set("preferences", "python_server_url", str(python_server))

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        cfg.write(f)

    resp = {"success": True, "new python url": python_server}

    return jsonify(resp), 200


@app.route("/get_settings", methods=["GET"])
def get_settings():
    try:
        config_dict = read_config()
    except FileNotFoundError:
        print('Config File not found')
        restart_server()
        return jsonify({"success": False, "error": "Config file not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    return jsonify({"success": True, "config": config_dict}), 200

@app.route("/restart_server", methods=["GET"])
def restart_server():
    python = sys.executable
    os.execv(python, [python] + sys.argv)

if __name__ == "__main__":
    with app.app_context():
        if not PYTHON_SERVER_URL.startswith(("http://", "https://")):
            PYTHON_SERVER_URL = "http://" + PYTHON_SERVER_URL

        p = urlparse(PYTHON_SERVER_URL)
        host = p.hostname or "127.0.0.1"
        port = p.port or 5000
        app.run(host=host, port=port, debug=True)