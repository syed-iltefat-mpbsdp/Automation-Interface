import pandas as pd
import os
import subprocess
from typing import Dict, Any, List
from datetime import datetime, timezone
from typing import List, Dict, Any
import pandas as pd
from openpyxl import load_workbook
import signal
import sys

def dump_rows_to_excel(rows: List[Dict[str, Any]], output_file: str, sheet_name: str = "default") -> Dict[str, Any]:
    try:
        os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)

        name = (sheet_name or "default").strip() or "default"
        df = pd.DataFrame.from_records(rows) if rows else pd.DataFrame()
        
        with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name=name)

        final_sheet = name
        return {
            "success": True,
            "message": f"Replaced {output_file} and wrote {len(df)} rows to sheet {final_sheet}",
            "rows": int(len(df)),
            "file": output_file,
            "sheet": final_sheet,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        return {"error": f"Failed to write Excel file: {str(e)}"}

def copy_test_cases(input_file: str, sheet_name: str, output_file: str, selected_headers: list = []) -> dict:
    try:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        df = pd.read_excel(input_file, sheet_name=sheet_name, engine="openpyxl")
        filtered_df = df[df['Selected'].astype(str).str.lower() == 'yes']

        if selected_headers:
            missing = [col for col in selected_headers if col not in filtered_df.columns]
            if missing:
                return {"error": f"Missing columns in sheet: {missing}"}
            filtered_df = filtered_df[selected_headers]

        filtered_df.to_excel(output_file, index=False, engine="openpyxl")
        return {"success": f"Filtered rows saved to {output_file}. Total rows: {len(filtered_df)}"}

    except Exception as e:
        return {"error": f"Error occurred: {e}"}




def run_batch_file(filename: str, file_path: str = "") -> Dict[str, Any]:
    try:
        if not file_path:
            file_path = os.path.join(os.getcwd(), filename)
        else:
            file_path = os.path.join(file_path, filename)
        file_path = os.path.abspath(file_path)

        if not os.path.isfile(file_path):
            return {"error": f"Batch file not found: {file_path}"}

        print(f"started subprocess {filename}")

        is_windows = os.name == "nt"
        timeout_seconds = 60

        if is_windows:
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
            proc = subprocess.Popen(
                file_path,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=creationflags
            )

        try:
            stdout, stderr = proc.communicate(timeout=timeout_seconds)
            return_code = proc.returncode

            if return_code != 0:
                return {
                    "error": f"Batch execution failed: {return_code}",
                    "file": file_path,
                    "stdout": stdout or "",
                    "stderr": stderr or ""
                }

            payload = {
                "success": True,
                "file": file_path,
                "stdout": stdout or "",
                "stderr": stderr or "",
            }
            payload["message"] = f"Batch executed successfully; stdout length: {len(payload['stdout'])}; stderr length: {len(payload['stderr'])}"
            return payload

        except subprocess.TimeoutExpired:
            try:
                if is_windows:
                    proc.send_signal(signal.CTRL_BREAK_EVENT)

            except Exception:
                pass

            try:
                stdout, stderr = proc.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    if is_windows:
                        proc.kill()
                    else:
                        os.killpg(proc.pid, signal.SIGKILL)
                    stdout, stderr = proc.communicate(timeout=5)
                except Exception:
                    stdout, stderr = ("", "")

            return {
                "error": f"Batch execution timed out after {timeout_seconds} seconds",
                "file": file_path,
                "stdout": stdout or "",
                "stderr": stderr or ""
            }

    except Exception as e:
        return {"error": f"Unexpected error executing batch file: {str(e)}"}
