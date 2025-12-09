
const batch_dir = "batch";
let PYTHON_SERVER_URL = ""

const GE =["TSTA_Streets_930", "TSTA_System_930"]
const MI =["TST_MPDS_Streets_454", "TST_MPDS_System_454"] 
const CA =["TSTA_Streets_921", "TSTA_System_921"] 
const HA =["TSTA_MPDS_Streets_920", "TSTA_MPDS_System_920"] 
const LO =["TSTA_Streets_910", "TSTA_System_910"]

db_map = {
  "EHSGIGECDSQL01.ehsa2.ca" : GE,
  "EHSGIMICDSQL01.ehsa2.ca" : MI,
  "EHSGICACDSQL01.ehsa2.ca" : CA,
  "EHSGIHACDSQL01.ehsa2.ca" : HA,
  "EHSGILOCDSQL01.ehsa2.ca" : LO,      
}

let sqlInterval = null;
const toggleBtn = document.getElementById("toggleBtn");

const INTERVAL_MS = 5000;

let output_dir = "static"; //default fallback dir
let default_server = "EHSGIGECDSQL01.ehsa2.ca";

async function init()
{    
    resetTimer();

    let python_server_cookie = getLocal('python_server_url');

    if (!python_server_cookie) {
      
      alert('Python Server URL is required. Please go to settings and change it');
      return null;
      
    }
    PYTHON_SERVER_URL = getLocal('python_server_url');
    console.log('cookie: ' + getLocal('python_server_url'))
    
    const res = await fetch(PYTHON_SERVER_URL+"get_settings", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    const dataObj = await res.json();
    if (!dataObj.success)
    {
        console.error("Failed to fetch settings")
    }
    config = dataObj.config
    preferences = config.preferences || ""

    db_select_element = document.getElementById("db-select");

    output_dir = preferences ? preferences.output_dir : output_dir;
    default_server = preferences ? preferences.default_server : default_server;
    db_username = preferences ? preferences?.db_username || "" : db_username;
    db_password = preferences ? preferences?.db_password || "" : db_password;

    if (!db_username || db_username === "" || !db_password || db_password === "")
    {
       console.error("set db username and password!")
       alert("Database Username or Password not set. Please go to settings and set them.")
    }


    db_select_element.value = preferences.default_server;
    changeDatabase();
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


document.addEventListener('DOMContentLoaded', () => {
  init();
});

function getQuery(query=""){
  if (query == ""){
    query = document.getElementById("query").value; 
  }

  return query;
}

async function sendSQLQuery(evnt, q) {
  if (evnt && typeof evnt.preventDefault === "function") {
    evnt.preventDefault();
    evnt.stopPropagation();
  
  }

  const query = getQuery(q);
  const responseDiv = document.getElementById("response");
  const timestampDiv = document.getElementById("timestamp");

  try {
    const res = await fetch(PYTHON_SERVER_URL+"query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const dataObj = await res.json();


    let data = dataObj;
    timestampDiv.textContent = "";

    if (dataObj.timestamp) {
      timestampDiv.textContent = "Fetched at: " + new Date(dataObj.timestamp).toLocaleString();
      data = dataObj.results;
    }
    
    responseDiv.innerHTML = "";
    if (!Array.isArray(data)) {
      const html = escapeHtml(JSON.stringify(data, null, 2));
      responseDiv.innerHTML = `<pre class="response-pre">${html}</pre>`;
      return;
    }
    if (data.length === 0) {
      responseDiv.innerHTML = '<p>No results found.</p>';
      return;
    }

    window.latestQueryResults = data;

    let table = '<table><thead><tr>';
    const columns = Object.keys(data[0]);
    columns.forEach(key => {
      table += '<th>' + escapeHtml(key) + '</th>';
    });
    table += '<th>Actions</th>';
    table += '</tr></thead><tbody>';

    data.forEach((row, rowIndex) => {
      table += '<tr>';
      columns.forEach(col => {
        const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
        table += '<td>' + escapeHtml(val) + '</td>';
      });

      const { actionHtml } = formatAAN(row, rowIndex);

      table += '<td>' + actionHtml + '</td>';
      table += '</tr>';
    });

    table += '</tbody></table>';
    responseDiv.innerHTML = table;
 
  } catch (error) {
    responseDiv.textContent = "Error: " + error;
    console.error("sendSQLQuery error:", error);
  }
  return false;
}

function formatAAN(row, rowIndex) {
  const statusVal = String(row['AAN_Status'] === null || row['AAN_Status'] === undefined ? '' : row['AAN_Status']);
  let actionHtml = '';

  if (statusVal === '.FD-m' || statusVal === 'FD-Ack') {
    actionHtml += `<button type="button" onclick="handleCMTClick(${rowIndex})">Send CMT</button> `;
    actionHtml += `<button type="button" onclick="handleCLS(${rowIndex})">Send CLS</button>`;
    actionHtml += `<button type="button" onclick="handleViewCMTClick(${rowIndex})">View Comment</button>`;

  } else if (statusVal === '') {
    actionHtml += `<button type="button" onclick="handleCommand(${rowIndex}, 'ACK')">Send ACK</button>`;
  }


  return { actionHtml, statusVal };
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function runBatchFile(fname="") {
    const statusEl = document.getElementById('batch-status') || (function(){
        const d = document.createElement('div');
        d.id = 'batch-status';
        d.style.marginTop = '12px';
        d.style.fontWeight = 'bold';
        document.getElementById('run-bat-file').insertAdjacentElement('afterend', d);
        return d;
    })();

    let pre = document.getElementById('batch-stdout');
    if (!pre) {
        pre = document.createElement('pre');
        pre.id = 'batch-stdout';
        pre.style.maxHeight = '240px';
        pre.style.overflow = 'auto';
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.background = '#f7f7f7';
        pre.style.padding = '8px';
        pre.style.border = '1px solid #ddd';
        pre.style.marginTop = '8px';
        statusEl.insertAdjacentElement('afterend', pre);
    }

    statusEl.textContent = "";
    statusEl.style.color = "black";
    pre.textContent = "";

    statusEl.style.color = 'black';
    statusEl.textContent = 'Running...';

    const filename = fname || (document.getElementById('batch-filename') && document.getElementById('batch-filename').value);

    try {
        const res = await fetch(PYTHON_SERVER_URL+'run_batch_script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            statusEl.style.color = 'red';
            statusEl.textContent = 'Unexpected non-JSON response. See console for details.';
            console.error('Non-JSON response from /run_batch_script:', text);
            return;
        }

        if (!res.ok || (data && data.error)) {
            
            statusEl.style.color = 'red';
            statusEl.textContent = data.error || 'Batch run failed';
            const stderr = data.stderr || '';
            const stdout = data.stdout || '';
            const msg = data.message ? data.message + '\n\n' : '';
            pre.textContent = msg + (stderr || stdout);
            console.error('Batch run failed:', data);
            return;
        }

        statusEl.style.color = 'green';
        statusEl.textContent = 'Batch succeeded';

        const out = data.stdout || '';
        const msg = data.message ? data.message + '\n\n' : '';

        const MAX_PREVIEW = 10000;
        if ((msg + out).length > MAX_PREVIEW) {
            pre.textContent = msg + out.slice(0, MAX_PREVIEW) + '\n\n[output truncated]';
        } else {
            pre.textContent = msg + out;
        }

        console.log('run_batch_script response:', data);
    } catch (err) {
        statusEl.style.color = 'red';
        statusEl.textContent = 'Error running batch: ' + (err && err.message ? err.message : String(err));
        console.error('fetch error calling /run_batch_script:', err);
    }
}

async function runCopy() {
    event.preventDefault();

    console.log('runCopy clicked, activeElement:', document.activeElement && document.activeElement.tagName);

    fetch(PYTHON_SERVER_URL+"run_copy")
        .then(res => res.json())
        .then(data => {
        console.log('run_copy response', data);
        const statusDiv = document.getElementById("copy-status");
        statusDiv.innerHTML = "";
        if (data && data.success) {
            const fromB = document.createElement("b");
            fromB.textContent = data.from;
            const toB = document.createElement("b");
            const link = document.createElement("a");
            link.href = data.to;
            link.textContent = data.to;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            toB.appendChild(link);

            statusDiv.appendChild(document.createTextNode("Copied from "));
            statusDiv.appendChild(fromB);
            statusDiv.appendChild(document.createTextNode(" to "));
            statusDiv.appendChild(toB);
            statusDiv.style.color = "green";
        } else {
            statusDiv.textContent = "Failed to copy test cases. Check the console for more info";
            statusDiv.style.color = "red";
            console.log(data)
        }
        })
        .catch(err => {
        console.error('run_copy error', err);
        const statusDiv = document.getElementById("copy-status");
        statusDiv.textContent = "Error running copy: " + err;
        statusDiv.style.color = "red";
        });
}

async function changeDatabase() {
    const newUrl = document.getElementById("db-select").value;
    fetch(PYTHON_SERVER_URL+"change_db", {
        method: "POST",
        headers: {
        "Content-Type": "application/json"
        },
        body: JSON.stringify({ new_url: newUrl })
    })
    .then(response => response.json())
    .then(data => {
        console.log("Database changed:", data);
        default_server = newUrl;
        loadSQL("SN")

    })
    .catch(error => {
        console.error("Error changing database:", error);
    });

}

function handleCLS(rowIndex)
{
  const overlay = document.getElementById("overlay");
  const overlayContent = document.getElementById("overlay-content");
  overlayContent.style.maxWidth = "300px"


  overlayContent.innerHTML = "";
  overlayContent.appendChild(createOverlayConfirmForm());

  overlay.style.display = "block";

  const form = document.getElementById("overlay-form");
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleCommand(rowIndex, 'CLS');
      overlay.style.display = "none";
      form.reset();
    };
  }
  
  

}

function createOverlayConfirmForm()
{
  const form = document.createElement("form");
  form.id = "overlay-form";

  const heading = document.createElement("h2");
  heading.textContent = "Send CLS (close)";
  form.appendChild(heading);


  const submitBtn = document.createElement("input");
  submitBtn.type = "submit";
  submitBtn.value = "Send CLS";
  form.appendChild(submitBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.marginTop = "5px";
  cancelBtn.style.backgroundColor = "red";
  cancelBtn.style.border = "none";
  cancelBtn.style.padding = "8px";
  cancelBtn.style.color = "white";
  cancelBtn.style.borderRadius = "5px";
  cancelBtn.onclick = cancelOverlay;
  form.appendChild(cancelBtn);

  return form;

}

async function handleCommand(rowIndex, action) {

  const row = (window.latestQueryResults || [])[rowIndex];

  const payload = {
    incident_number: row.master_incident_number,
    action: action,
    sheet: "Parameters",
    output_file: "AANParameters.xlsx",
    output_dir: output_dir,
    comments: `Test Comment From ${action}`

  };
  console.log(payload.output_dir)

  const res = await fetch(PYTHON_SERVER_URL+"command_to_excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const dataObj = await res.json();
  console.log(dataObj);

  if (dataObj.success !== true || dataObj.rows < 1) {
    console.log("Something went wrong");
    return false;
  }

  runBatchFile(batch_dir+"/CIP_SN_Test.bat");
    
  const element = document.getElementById("batch-status");
  element.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
  return true;
}

async function handleCMT(rowIndex) {
  const row = (window.latestQueryResults || [])[rowIndex];

  const comments = document.getElementById("comments")?.value || "";
  if (comments === "")
  {
    alert("Comments cannot be empty");
    return false;
  }
  const notification = document.getElementById("notification").checked ? "true" : "";
  const hazard = document.getElementById("hazard").checked ? "true" : "";
  const caution_notes = document.getElementById("caution_notes").checked ? "true" : "";
  const confidential = document.getElementById("confidential").checked ? "true" : "";

  const payload = {
    incident_number: row.master_incident_number,
    action: "CMT",
    sheet: "Parameters",
    output_file: "AANParameters.xlsx",
    output_dir: output_dir,
    comments,
    notification,
    hazard,
    caution_notes,
    confidential
  };
  console.log('handle CMT called')

  const res = await fetch(PYTHON_SERVER_URL+"command_to_excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const dataObj = await res.json();
  console.log(dataObj);

  if (dataObj.success !== true || dataObj.rows < 1) {
    console.log("Something went wrong");
    return false;
  }

  runBatchFile(batch_dir+"/CIP_SN_Test.bat");
    
  const element = document.getElementById("batch-status");
  element.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
  
  return true;
}

async function handleViewCMT(rowIndex) {
  try {
     const row = (window.latestQueryResults || [])[rowIndex];

    incident_number= row.master_incident_number

    selected_url = document.getElementById("db-select").value
    selected_db = db_map[selected_url][1]

    query = `SELECT a.master_incident_number,b.date_time AS DateTime,b.Performed_By AS Initials,b.Comment AS "Comments/Notes"
          FROM [${selected_db}].dbo.response_master_incident a INNER JOIN [${selected_db}].dbo.Response_Comments  b 
          ON b.master_incident_id=a.id 
          WHERE a.master_incident_number='${incident_number}'
          ORDER BY b.Date_Time desc;`

    const res = await fetch(PYTHON_SERVER_URL+"query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    const dataObj = await res.json();

    let commentsArray = Array.isArray(dataObj?.results) ? dataObj.results : null;

    const candidateProps = ["comments", "cmts", "cmt", "commentList", "comments_list", "notes", "Comments/Notes"];
    if (!Array.isArray(commentsArray)) {
      for (const p of candidateProps) {
        if (Array.isArray(row[p])) {
          commentsArray = row[p];
          break;
        }
      }
    }

    if (!Array.isArray(commentsArray) && Array.isArray(dataObj)) {
      commentsArray = dataObj;
    }

    if (!Array.isArray(commentsArray) && (row["Comments/Notes"] || row["Comments"] || row.comments)) {
      commentsArray = [row];
    }

    const firstItem = Array.isArray(commentsArray) && commentsArray.length ? commentsArray[0] : null;
    const masterIncident = firstItem?.master_incident_number || row.master_incident_number || "";
    let topDateTime = firstItem?.DateTime || firstItem?.dateTime || firstItem?.datetime || "";

    if (topDateTime) {
      const parsed = new Date(topDateTime);
      if (!isNaN(parsed)) topDateTime = parsed.toLocaleString();
    }

    const masterEl = document.getElementById("view-master-incident-number");
    const list = document.getElementById("view-comments-list");

    if (masterEl) masterEl.textContent = masterIncident ? `Incident: ${masterIncident}` : "Incident: -";

    if (!Array.isArray(commentsArray) || commentsArray.length === 0) {
      if (list) list.innerHTML = "<p>No comments available.</p>";
      return;
    }
    list.innerHTML = "";

    // create table and header
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";
    table.style.fontSize = "0.95rem";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    const makeTh = (text) => {
      const th = document.createElement("th");
      th.textContent = text;
      th.style.textAlign = "left";
      th.style.verticalAlign = "middle";

      th.style.padding = "8px 10px";
      th.style.borderBottom = "1px solid #e6e6e6";
      th.style.background = "#fafafa";
      th.style.fontWeight = "600";
      th.style.color = "#222";


      if (text.toLowerCase() === "date") {
        th.style.minWidth = "90px";
      }

      return th;
    };

    headRow.appendChild(makeTh("Date"));
    headRow.appendChild(makeTh("Time"));
    headRow.appendChild(makeTh("Initials"));
    headRow.appendChild(makeTh("Comments / Notes"));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    // populate rows
    commentsArray.forEach(item => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #f1f1f1";

      const dtRaw = item.DateTime || item.dateTime || item.datetime || "";
      const dtObj = new Date(dtRaw);
      const dateText = !isNaN(dtObj) ? dtObj.toLocaleDateString() : (item.Date || item.date || "");
      const timeText = !isNaN(dtObj) ? dtObj.toLocaleTimeString() : (item.Time || item.time || "");

      const td = (text) => {
        const tdEl = document.createElement("td");
        tdEl.style.padding = "8px 10px";
        tdEl.style.verticalAlign = "top";
        tdEl.style.color = "#111";
        tdEl.textContent = text;
        tdEl.style.verticalAlign = "middle";
        return tdEl;
      };

      const initialsText = item.Initials || item.initials || item.Initial || "";
      const notesText = item["Comments/Notes"] || item["Comments"] || item.comments || item.note || "";

      tr.appendChild(td(dateText));
      tr.appendChild(td(timeText));
      tr.appendChild(td(initialsText));
      const notesTd = td("");
      notesTd.style.whiteSpace = "pre-wrap";
      notesTd.textContent = notesText;
      tr.appendChild(notesTd);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    list.appendChild(table);


  } catch (err) {
    console.error("handleViewCMT error:", err);
    const list = document.getElementById("view-comments-list");
    if (list) list.innerHTML = `<p style="color:red">Error loading comments.</p>`;
  }
}

function createOverlayForm() {
  const form = document.createElement("form");
  form.id = "overlay-form";

  const heading = document.createElement("h2");
  heading.textContent = "Send CMT";
  form.appendChild(heading);

  const commentsLabel = document.createElement("label");
  commentsLabel.setAttribute("for", "comments");
  commentsLabel.textContent = "Comments:";
  form.appendChild(commentsLabel);

  const commentsBox = document.createElement("textarea");
  commentsBox.id = "comments";
  commentsBox.name = "comments";
  commentsBox.rows = 3;
  commentsBox.style.marginBottom = "10px";
  form.appendChild(commentsBox);

  const checkboxContainer = document.createElement("div");
  checkboxContainer.style.display = "flex";
  checkboxContainer.style.justifyContent = "center";
  checkboxContainer.style.gap = "24px";

  const fields = [
    { id: "notification", label: "Notification" },
    { id: "hazard", label: "Hazard" },
    { id: "caution_notes", label: "Caution Notes" },
    { id: "confidential", label: "Confidential" }
  ];

  fields.forEach(f => {
    const wrapper = document.createElement("div");
    const lbl = document.createElement("label");
    lbl.setAttribute("for", f.id);
    lbl.textContent = f.label;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = f.id;
    cb.name = f.id;
    cb.value = "true";
    wrapper.appendChild(lbl);
    wrapper.appendChild(cb);
    checkboxContainer.appendChild(wrapper);
  });

  form.appendChild(checkboxContainer);

  const submitBtn = document.createElement("input");
  submitBtn.type = "submit";
  submitBtn.value = "Submit";
  form.appendChild(submitBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.marginTop = "5px";
  cancelBtn.style.backgroundColor = "red";
  cancelBtn.style.border = "none";
  cancelBtn.style.padding = "8px";
  cancelBtn.style.color = "white";
  cancelBtn.style.borderRadius = "5px";
  cancelBtn.onclick = cancelOverlay;
  form.appendChild(cancelBtn);

  return form;
}

function createOverlayFormViewCMT() {
  const container = document.createElement("div");
  container.id = "view-cmt-container";
  container.style.overflowY = "auto";
  container.style.width = "min(800px, 95%)";
  container.style.width = "100%";

  container.style.maxHeight = "80vh";

  const header = document.createElement("div");
  header.style.marginBottom = "12px";

  const masterEl = document.createElement("div");
  masterEl.id = "view-master-incident-number";
  masterEl.style.fontWeight = "700";
  masterEl.style.fontSize = "1.1rem";
  header.appendChild(masterEl);

  const dtEl = document.createElement("div");
  dtEl.id = "view-datetime";
  dtEl.style.color = "#555";
  dtEl.style.fontSize = "0.95rem";
  header.appendChild(dtEl);

  container.appendChild(header);

  const listTitle = document.createElement("h3");
  listTitle.textContent = "Comments";
  listTitle.style.margin = "8px 0";
  container.appendChild(listTitle);

  const list = document.createElement("div");
  list.id = "view-comments-list";
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "10px";
  container.appendChild(list);



  

  return container;
}

async function handleViewCMTClick(rowIndex) {
  const overlay = document.getElementById("overlay");
  const overlayContent = document.getElementById("overlay-content");
  overlayContent.style.maxWidth = "100%"

  overlayContent.innerHTML = "";
  overlayContent.appendChild(createOverlayFormViewCMT());

  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const closeWrap = document.createElement("div");
  closeWrap.style.marginTop = "12px";
  closeWrap.style.textAlign = "right";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.style.padding = "8px 12px";
  closeBtn.style.background = "#d33";
  closeBtn.style.color = "white";
  closeBtn.style.border = "none";
  closeBtn.style.borderRadius = "6px";
  closeBtn.onclick = cancelOverlay;

  closeWrap.appendChild(closeBtn);
  overlayContent.appendChild(closeWrap);

  try {
    await handleViewCMT(rowIndex);
  } catch (err) {
    console.error("handleViewCMT error:", err);
  }
}

function handleCMTClick(rowIndex) {
  const overlay = document.getElementById("overlay");
  const overlayContent = document.getElementById("overlay-content");
  overlayContent.style.maxWidth = "450px"

  overlayContent.innerHTML = "";
  overlayContent.appendChild(createOverlayForm());

  overlay.style.display = "block";

  const form = document.getElementById("overlay-form");
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleCMT(rowIndex);
      overlay.style.display = "none";
      form.reset();
    };
  }
  
}

function cancelOverlay() {
  const form = document.getElementById("overlay-form");
  const overlay = document.getElementById("overlay");

  if (form) {
    form.reset(); // clear all inputs
  }
  if (overlay) {
    overlay.style.display = "none"; // hide overlay

  }
}

function loadSQL(type){
  query_element = document.getElementById('query')
  if (type == 'SN') {
    query_element.value = `SELECT DISTINCT
  a.master_incident_number,
  methodofcallRcvd AS AAN_Status,
  Time_CallEnteredQueue,
  Problem,
  Response_Area
FROM [${db_map[default_server][1]}].dbo.response_master_incident a 
    INNER JOIN [${db_map[default_server][1]}].dbo.Response_Comments b 
    ON b.master_incident_id=a.id 
WHERE 
    a.Call_Is_Active=1
    AND datediff(day, a.Time_CallEnteredQueue, getdate()) <=15
    AND LTRIM(b.comment) LIKE '%CIP SN solution (SN01)] Fire notification SENT%' 
    AND a.methodofcallRcvd not in ('FD-To','FD-C')
ORDER BY Time_CallEnteredQueue DESC;`
  }
}



toggleBtn.addEventListener("click", (event) => {
  const isOff = toggleBtn.classList.contains("toggle-off");
  switchAutoFetch(isOff);
});

function switchAutoFetch(mode){
  const toggleContent = document.getElementById("toggle-content");
  const tooltiptext = document.getElementById("tooltiptext");

  if (mode) {
    // switch to ON
    toggleBtn.classList.remove("toggle-off");
    toggleBtn.classList.add("toggle-on");

    toggleContent.textContent = "Auto Fetch: ON";
    tooltiptext.textContent = "Fetches every 5 seconds: ON";


    // avoid creating a second interval
    if (!sqlInterval) {
      sqlInterval = setInterval(() => {
        sendSQLQuery(event, "");
      }, INTERVAL_MS);
    }
  } else {
    // switch to OFF
    toggleBtn.classList.remove("toggle-on");
    toggleBtn.classList.add("toggle-off");


    toggleContent.textContent = "Auto Fetch: OFF";
    tooltiptext.textContent = "Fetches every 5 seconds: OFF";

    if (sqlInterval) {
      clearInterval(sqlInterval);
      sqlInterval = null;
    }
  }
}

//inactivity checker for autofetch

let inactivityTimer;
const TIMEOUT_MINUTES = 2;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;

let hiddenAt = null; // when tab was hidden

function triggerInactive() {
  switchAutoFetch(false);
  console.log(`User inactive for ${TIMEOUT_MINUTES} minutes`);
  alert(`User inactive for ${TIMEOUT_MINUTES} minutes`)
}

function resetTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(triggerInactive, TIMEOUT_MS);
}

// Reset timer on common activity events
["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(evt =>
  document.addEventListener(evt, resetTimer)
);

// Track tab visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // record when tab went hidden
    hiddenAt = Date.now();
    clearTimeout(inactivityTimer);
  } else {
    // tab became visible again
    if (hiddenAt) {
      const hiddenDuration = Date.now() - hiddenAt;
      if (hiddenDuration >= TIMEOUT_MS) {
        triggerInactive(); // user was away too long
      } else {
        resetTimer(); // resume normal inactivity timer
      }
      hiddenAt = null;
    } else {
      resetTimer();
    }
  }
});
