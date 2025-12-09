import os
from dotenv import load_dotenv
from typing import List, Dict
from configparser import ConfigParser
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent 
CONFIG_PATH = Path("settings.config")

#read parameters using .env file -- Obsolete -- 
#DB_PORT = os.getenv("DB_PORT")
#DB_USER = os.getenv("DB_USER")
#DB_PASS = os.getenv("DB_PASS")
#assert all([DB_PORT, DB_USER, DB_PASS]), "Missing one or more DB environment variables"

def read_config(path: Path = CONFIG_PATH) -> dict:
    cfg = ConfigParser()
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    cfg.read(path)
    result = {}
    for section in cfg.sections():
        result[section] = {}
        for key, val in cfg.items(section):
            result[section][key] = val
    return result

def write_preferences(path: Path, prefs: dict):
    cfg = ConfigParser()
    cfg["preferences"] = {
        "output_dir": prefs["output_dir"],
        "default_server": prefs["default_server"],
        "db_username": prefs["db_username"],
        "db_password": prefs["db_password"],
        "db_port": str(prefs["db_port"]),
        "python_server_url": str(prefs["python_server_url"])
    }
    with path.open("w", encoding="utf-8") as f:
        cfg.write(f)

def prompt_for_preferences(initial: dict | None = None) -> dict | None:
    # tkinter gui to ask user for preferences
    initial = initial or {}
    root = tk.Tk()
    root.title("Initial Settings")
    root.resizable(False, False)

    root.attributes("-topmost", True)
    frm = ttk.Frame(root, padding=12)
    frm.grid(row=0, column=0)

    # helpers
    def choose_dir(entry_widget):
        d = filedialog.askdirectory(parent=root, title="Select output directory")
        if d:
            entry_widget.delete(0, tk.END)
            entry_widget.insert(0, d)

    # Labels and entries
    labels = {
        "output_dir": "Output directory",
        "default_server": "Default server",
        "db_username": "DB username",
        "db_password": "DB password",
        "db_port": "DB port",
        "python_server_url": "Python Server URL"
    }
    entries = {}

    for i, key in enumerate(labels):
        ttk.Label(frm, text=labels[key]).grid(row=i, column=0, sticky="w", pady=4)
        ent = ttk.Entry(frm, width=40)
        ent.grid(row=i, column=1, sticky="w", padx=(6, 0))
        entries[key] = ent

    # password masking
    entries["db_password"].config(show="*")

    # prefill
    if initial:
        for k, v in initial.items():
            if k in entries and v is not None:
                entries[k].insert(0, str(v))

    # output_dir chooser button
    choose_btn = ttk.Button(frm, text="Browse", command=lambda: choose_dir(entries["output_dir"]))
    choose_btn.grid(row=0, column=2, padx=(6, 0))

    # action buttons
    result = {"saved": False, "prefs": None}

    def on_save():
        # basic validation
        out = entries["output_dir"].get().strip()
        server = entries["default_server"].get().strip()
        user = entries["db_username"].get().strip()
        pwd = entries["db_password"].get()
        port = entries["db_port"].get().strip()
        python_server = entries["python_server_url"].get().strip()


        if not out:
            messagebox.showerror("Validation error", "Output directory is required", parent=root)
            return
        if not server:
            messagebox.showerror("Validation error", "Default server is required", parent=root)
            return
        if not python_server:
            messagebox.showerror("Validation error", "Python server is required", parent=root)
            return

        if not port.isdigit():
            messagebox.showerror("Validation error", "DB port must be a number", parent=root)
            return

        prefs = {
            "output_dir": out,
            "default_server": server,
            "db_username": user,
            "db_password": pwd,
            "db_port": int(port),
            "python_server_url" : python_server
        }
        result["saved"] = True
        result["prefs"] = prefs
        root.destroy()

    def on_cancel():
        root.destroy()

    btn_frame = ttk.Frame(frm)
    btn_frame.grid(row=len(labels), column=0, columnspan=3, pady=(10, 0), sticky="e")
    ttk.Button(btn_frame, text="Cancel", command=on_cancel).grid(row=0, column=0, padx=6)
    ttk.Button(btn_frame, text="Save", command=on_save).grid(row=0, column=1)

    # center window
    root.update_idletasks()
    w = root.winfo_width()
    h = root.winfo_height()
    x = (root.winfo_screenwidth() // 2) - (w // 2)
    y = (root.winfo_screenheight() // 2) - (h // 2)
    root.geometry(f"+{x}+{y}")

    root.mainloop()

    return result["prefs"] if result["saved"] else None

def ensure_config(path: Path = CONFIG_PATH) -> dict:
    try:
        return read_config(path)
    except FileNotFoundError:
        # default parameters
        defaults = {
            "output_dir": str(BASE_DIR / "static"),
            "default_server": "EHSGIGECDSQL01.ehsa2.ca",
            "db_username": "",
            "db_password": "",
            "db_port": 1433,
            "python_server_url":"http://127.0.0.1:5000/"
        }
        prefs = prompt_for_preferences(initial=defaults)
        if prefs is None:
            raise SystemExit("Configuration required. Exiting.")
        write_preferences(path, prefs)
        return read_config(path)

#read config file and variables
CONFIG = ensure_config(CONFIG_PATH)
preferences=CONFIG["preferences"]
DB_HOST = preferences["default_server"]
DB_PORT = preferences["db_port"]
DB_USER = preferences["db_username"]
DB_PASS = preferences["db_password"]
PYTHON_SERVER_URL = preferences["python_server_url"]

SQLALCHEMY_DATABASE_URI = f"mssql+pyodbc://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/CIP?driver=ODBC+Driver+17+for+SQL+Server"
print(f"LOADED CONFIG")
def get_server_info() -> Dict[str,str]:
    return {"host": DB_HOST, "port": DB_PORT, "user": DB_USER}

def change_db_uri(NEW_DB_NAME: str):
    global DB_HOST
    DB_HOST = NEW_DB_NAME
    return f"mssql+pyodbc://{DB_USER}:{DB_PASS}@{NEW_DB_NAME}:{DB_PORT}/CIP?driver=ODBC+Driver+17+for+SQL+Server"

def change_db_info(host = DB_HOST, user = DB_USER, password = DB_PASS, port = DB_PORT):
    global DB_HOST, DB_USER, DB_PASS, DB_PORT
    DB_HOST = host
    DB_USER = user
    DB_PASS = password 
    DB_PORT = port
    SQLALCHEMY_DATABASE_URI = f"mssql+pyodbc://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/CIP?driver=ODBC+Driver+17+for+SQL+Server"
    return SQLALCHEMY_DATABASE_URI