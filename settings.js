let PYTHON_SERVER_URL = "";
async function init()
{       
    let python_server_cookie = getLocal('python_server_url');

    if (!python_server_cookie) {
      python_server_cookie = prompt("Enter Python server URL (e.g. http://127.0.0.1:5000/). Please ensure trailing '/'", 'http://127.0.0.1:5000/');
      if (python_server_cookie) {
        const normalized = normalizeAndValidateUrl(python_server_cookie);
        if (!normalized) {
          alert("Please enter a valid URL, for example: http://127.0.0.1:5000/");
          return;
        }
        
        try {
          const res = await fetch(normalized, { method: 'GET' });
          if (!res.ok) {
            alert('Please make sure the Python server URL is valid and running');
            return;
          }
          // success path
        } catch (err) {
          // network error, DNS, blocked port, CORS, etc.
          alert('Network error while contacting the Python server. Check the URL and that the server is running.');
          console.error(err);
          return
        }


      } else {
        alert('Python Server URL is required.');
        return null;
      }
    }
    setLocal('python_server_url', python_server_cookie);
    PYTHON_SERVER_URL = getLocal('python_server_url');
    console.log('cookie: ' + getLocal('python_server_url'))

    const res = await fetch(PYTHON_SERVER_URL+"get_settings", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok){
      deleteLocal('python_server_url')
      console.log(res)
    }
    
    const dataObj = await res.json();
    if (!dataObj.success)
    {
        console.error("Failed to fetch settings")
        return;
    }
    config = dataObj.config
    preferences = config.preferences

    const default_dir_input_element = document.getElementById("output_dir");
    const db_select_element = document.getElementById("db-select");
    const db_username_element = document.getElementById("db_username");
    const db_password_element = document.getElementById("db_password");
    const db_port_element = document.getElementById("db_port");
    const python_server_element = document.getElementById("python_server_url");

    if (python_server_cookie !== preferences.python_server_url){
      setLocal('python_server_url', preferences.python_server_url);
    }
    
    default_dir_input_element.value = preferences.output_dir
    db_select_element.value = preferences.default_server
    db_username_element.value = preferences.db_username
    db_password_element.value = preferences.db_password
    db_port_element.value = preferences.db_port
    python_server_element.value = preferences.python_server_url


}

function normalizeAndValidateUrl(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;

  // add trailing slash if missing
  const withSlash = s.endsWith('/') ? s : s + '/';

  // basic validation using the URL constructor
  try {
    const u = new URL(withSlash);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return withSlash;
  } catch (e) {
    return null;
  }
}

// store (string or object)
function setLocal(name, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  localStorage.setItem(name, v);
}

// read (returns string or parsed object if JSON)
function getLocal(name) {
  const v = localStorage.getItem(name);
  if (v === null) return null;
  try {
    return JSON.parse(v);
  } catch (e) {
    return v;
  }
}

// delete
function deleteLocal(name) {
  localStorage.removeItem(name);
}

async function changePythonServerURL(){
  const python_server_element = document.getElementById("python_server_url")
  
  const statusEl = document.getElementById("settings-status-2");
  const saveBtn = document.getElementById("python-save-btn");
  try {
    const res = await fetch(python_server_element.value, { method: 'GET' });
    if (!res.ok) {
      alert('Please make sure the Python server URL is valid and running');
      return;
    }
    // success path
  } catch (err) {
    // network error, DNS, blocked port, CORS, etc.
    alert('Network error while contacting the Python server. Check the URL and that the server is running.');
    console.error(err);
    return
  }

  const payload = {
    python_server_url : python_server_element ? python_server_element.value : ""

  };

  // disable UI while saving
  saveBtn.disabled = true;
  setStatus("Saving...", "pending");
  try {
    const res = await fetch(python_server_element.value+"change_python_url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = (data && data.error) || `Server returned ${res.status}`;
      setStatus(`Error: ${msg}`, "error");
      saveBtn.disabled = false;
      return;
    }

    if (data && data.success) {
      let python_server_cookie = getLocal('python_server_url');
      if (!python_server_cookie || python_server_cookie !== python_server_url){
        setLocal('python_server_url', python_server_element.value);
        PYTHON_SERVER_URL = getLocal('python_server_url');
      }
      setStatus("Settings updated successfully.", "success");
    } else {
      const msg = (data && data.error) || "Unknown error. Refresh the page and try again";
      setStatus(`Error: ${msg}`, "error. Refresh the page and try again");
    }
  } catch (err) {
    setStatus(`Network error: ${err.message}`, "error. Refresh the page and try again");
  } finally {
    saveBtn.disabled = false;
  }

  function setStatus(message, type) {
  // type: "pending" | "success" | "error"
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = type === "success" ? "green" : type === "error" ? "crimson" : "#333";
  }

  const res = await fetch(PYTHON_SERVER_URL+"get_settings", {
  method: "GET",
  headers: { "Content-Type": "application/json" },
  });
  
  const dataObj = await res.json();
  if (!dataObj.success)
  {
    console.error("Failed to fetch settings")
    return;
  }
  config = dataObj.config
  preferences = config.preferences

  const default_dir_input_element = document.getElementById("output_dir");
  const db_select_element = document.getElementById("db-select");
  const db_username_element = document.getElementById("db_username");
  const db_password_element = document.getElementById("db_password");
  const db_port_element = document.getElementById("db_port");
  
  default_dir_input_element.value = preferences.output_dir
  db_select_element.value = preferences.default_server
  db_username_element.value = preferences.db_username
  db_password_element.value = preferences.db_password
  db_port_element.value = preferences.db_port

  

}

async function changeSettings() {
  const dirInput = document.getElementById("output_dir");
  const serverSelect = document.getElementById("db-select");
  const db_username_element = document.getElementById("db_username");
  const db_password_element = document.getElementById("db_password");
  const db_port_element = document.getElementById("db_port");

  const statusEl = document.getElementById("settings-status");
  const saveBtn = document.getElementById("save-btn");
  

  const payload = {
    directory: dirInput ? dirInput.value.trim() : "",
    default_server: serverSelect ? serverSelect.value : "",
    db_username: db_username_element ? db_username_element.value : "",
    db_password: db_password_element ? db_password_element.value : "",
    db_port: db_port_element ? db_port_element.value : "",
  };

  // simple client-side validation
  if (!payload.directory) {
    setStatus("Please provide an output directory.", "error");
    return;
  }

  // disable UI while saving
  saveBtn.disabled = true;
  setStatus("Saving...", "pending");
  try {
    const res = await fetch(PYTHON_SERVER_URL+"change_settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = (data && data.error) || `Server returned ${res.status}`;
      setStatus(`Error: ${msg}`, "error");
      saveBtn.disabled = false;
      return;
    }

    if (data && data.success) {
      setStatus("Settings updated successfully.", "success");
    } else {
      const msg = (data && data.error) || "Unknown error. Refresh the page and try again";
      setStatus(`Error: ${msg}`, "error. Refresh the page and try again");
    }
  } catch (err) {
    setStatus(`Network error: ${err.message}`, "error. Refresh the page and try again");
  } finally {
    saveBtn.disabled = false;
  }

  function setStatus(message, type) {
  // type: "pending" | "success" | "error"
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = type === "success" ? "green" : type === "error" ? "crimson" : "#333";
  }
  
}


document.addEventListener('DOMContentLoaded', () => {
  init();
});