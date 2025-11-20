import os
from dotenv import load_dotenv
from typing import List, Dict

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
assert all([DB_HOST, DB_PORT, DB_USER, DB_PASS]), "Missing one or more DB environment variables"

SQLALCHEMY_DATABASE_URI = f"mssql+pyodbc://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/CIP?driver=ODBC+Driver+17+for+SQL+Server"

def get_server_info() -> Dict[str,str]:
    return {"host": DB_HOST, "port": DB_PORT, "user": DB_USER}

def change_db_uri(NEW_DB_NAME: str):
    DB_HOST = NEW_DB_NAME
    return f"mssql+pyodbc://{DB_USER}:{DB_PASS}@{NEW_DB_NAME}:{DB_PORT}/CIP?driver=ODBC+Driver+17+for+SQL+Server"