const batch_dir = "batch";

const GE =["TSTA_Streets_930", "TSTA_System_930"]
const MI =["TST_MPDS_Streets_454", "TST_MPDS_System_454"] 
const CA =["TSTA_Streets_921", "TSTA_System_921"] 
const HA =["TSTA_Streets_920", "TSTA_System_920"] 
const LO =["TSTA_Streets_910", "TSTA_System_910"]

db_map = {
  "EHSGIGECDSQL01.ehsa2.ca" :["TSTA_Streets_930", "TSTA_System_930"],
  "EHSGIMICDSQL01.ehsa2.ca" :["TST_MPDS_Streets_454", "TST_MPDS_System_454"],
  "EHSGICACDSQL01.ehsa2.ca" :["TSTA_Streets_921", "TSTA_System_921"],
  "EHSGIHACDSQL01.ehsa2.ca" :["TSTA_Streets_920", "TSTA_System_920"],
  "EHSGILOCDSQL01.ehsa2.ca" :["TSTA_Streets_910", "TSTA_System_910"],      
}

let sqlInterval = null;
const toggleBtn = document.getElementById("toggleBtn");
const INTERVAL_MS = 5000;

async function sendSQLQuery(evnt) {
  if (evnt && typeof evnt.preventDefault === "function") {
    evnt.preventDefault();
    evnt.stopPropagation();
    
  }

  const query = document.getElementById("query").value;
  const responseDiv = document.getElementById("response");
  const timestampDiv = document.getElementById("timestamp");

  try {
    const res = await fetch("http://127.0.0.1:5000/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const dataObj = await res.json();

    console.log(dataObj)

    let data = dataObj;
    timestampDiv.textContent = "";

    if (dataObj.timestamp) {
      timestampDiv.textContent = "Fetched at: " + new Date(dataObj.timestamp).toLocaleString();
      data = dataObj.results;
    }
    
    responseDiv.innerHTML = "";
    if (!Array.isArray(data)) {
      responseDiv.innerHTML = '<pre>' + escapeHtml(JSON.stringify(data, null, 2)) + '</pre>';
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
    actionHtml += `<button type="button" onclick="handleCommand(${rowIndex}, 'CLS')">Send CLS</button>`;
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
        const res = await fetch('http://127.0.0.1:5000/run_batch_script', {
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

    fetch("http://127.0.0.1:5000/run_copy")
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
    fetch("http://127.0.0.1:5000/change_db", {
        method: "POST",
        headers: {
        "Content-Type": "application/json"
        },
        body: JSON.stringify({ new_url: newUrl })
    })
    .then(response => response.json())
    .then(data => {
        console.log("Database changed:", data);
    })
    .catch(error => {
        console.error("Error changing database:", error);
    });
}

async function handleCommand(rowIndex, action) {

  const row = (window.latestQueryResults || [])[rowIndex];

  const payload = {
    incident_number: row.master_incident_number,
    action: action,
    sheet: "Parameters",
    output_file: "AANParameters.xlsx",
    comments: `Test Comment From ${action}`
  };

  const res = await fetch("http://127.0.0.1:5000/command_to_excel", {
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
  const notification = document.getElementById("notification").checked ? "true" : "";
  const hazard = document.getElementById("hazard").checked ? "true" : "";
  const caution_notes = document.getElementById("caution_notes").checked ? "true" : "";
  const confidential = document.getElementById("confidential").checked ? "true" : "";

  const payload = {
    incident_number: row.master_incident_number,
    action: "CMT",
    sheet: "Parameters",
    output_file: "AANParameters.xlsx",
    comments,
    notification,
    hazard,
    caution_notes,
    confidential
  };

  const res = await fetch("http://127.0.0.1:5000/command_to_excel", {
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

    const res = await fetch("http://127.0.0.1:5000/query", {
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
    const dtEl = document.getElementById("view-datetime");
    const list = document.getElementById("view-comments-list");

    if (masterEl) masterEl.textContent = masterIncident ? `Incident: ${masterIncident}` : "Incident: -";
    if (dtEl) dtEl.textContent = topDateTime ? `Date: ${topDateTime}` : "";

    if (!Array.isArray(commentsArray) || commentsArray.length === 0) {
      if (list) list.innerHTML = "<p>No comments available.</p>";
      return;
    }

    list.innerHTML = "";
    commentsArray.forEach(item => {
      const rowWrap = document.createElement("div");
      rowWrap.style.border = "1px solid #eee";
      rowWrap.style.padding = "8px";
      rowWrap.style.borderRadius = "6px";
      rowWrap.style.background = "#fafafa";
      rowWrap.style.marginBottom = "8px";

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.gap = "12px";
      header.style.marginBottom = "6px";

      const initials = document.createElement("div");
      initials.style.fontWeight = "700";
      initials.textContent = item.Initials || item.initials || item.Initial || "";

      const dt = document.createElement("div");
      let dtText = item.DateTime || item.dateTime || item.datetime || "";
      const p = new Date(dtText);
      if (!isNaN(p)) dtText = p.toLocaleString();
      dt.style.color = "#666";
      dt.style.fontSize = "0.9rem";
      dt.textContent = dtText;

      header.appendChild(initials);
      header.appendChild(dt);

      const text = document.createElement("div");
      text.textContent = item["Comments/Notes"] || item["Comments"] || item.comments || item.note || "";
      text.style.whiteSpace = "pre-wrap";
      text.style.color = "#222";

      rowWrap.appendChild(header);
      rowWrap.appendChild(text);
      list.appendChild(rowWrap);
    });

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
  container.appendChild(closeWrap);

  return container;
}

async function handleViewCMTClick(rowIndex) {
  const overlay = document.getElementById("overlay");
  const overlayContent = document.getElementById("overlay-content");

  overlayContent.innerHTML = "";
  overlayContent.appendChild(createOverlayFormViewCMT());

  overlay.style.display = "block";

  try {
    await handleViewCMT(rowIndex);
  } catch (err) {
    console.error("handleViewCMT error:", err);
  }
}

function handleCMTClick(rowIndex) {
  const overlay = document.getElementById("overlay");
  const overlayContent = document.getElementById("overlay-content");

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

toggleBtn.addEventListener("click", (event) => {
  const isOff = toggleBtn.classList.contains("toggle-off");

  if (isOff) {
    // switch to ON
    toggleBtn.classList.remove("toggle-off");
    toggleBtn.classList.add("toggle-on");
    toggleBtn.textContent = "Auto Fetch: ON";

    // avoid creating a second interval
    if (!sqlInterval) {
      sqlInterval = setInterval(() => {
        sendSQLQuery(event);
      }, INTERVAL_MS);
    }
  } else {
    // switch to OFF
    toggleBtn.classList.remove("toggle-on");
    toggleBtn.classList.add("toggle-off");
    toggleBtn.textContent = "Auto Fetch: OFF";

    if (sqlInterval) {
      clearInterval(sqlInterval);
      sqlInterval = null;
    }
  }
});