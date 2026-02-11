// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";
const IMAGE_FOLDER = "images";

// 1. AUTH & INIT
if (sessionStorage.getItem('ecw_auth') !== 'true') window.location.href = 'index.html';
function logout() { sessionStorage.removeItem('ecw_auth'); window.location.href = 'index.html'; }

// UI FUNCTIONALITY: Token Lock & Copy Repo
const tokenInput = document.getElementById('githubToken');
const tokenLockBtn = document.getElementById('tokenLockBtn');
let isTokenLocked = true;

const savedToken = localStorage.getItem('ecw_gh_token');
if (savedToken) tokenInput.value = savedToken;

tokenLockBtn.onclick = () => {
    isTokenLocked = !isTokenLocked;
    if (isTokenLocked) {
        tokenInput.type = 'password'; tokenInput.readOnly = true;
        tokenLockBtn.innerText = '🔒'; tokenLockBtn.title = 'Unlock to Edit';
        localStorage.setItem('ecw_gh_token', tokenInput.value.trim());
    } else {
        tokenInput.type = 'text'; tokenInput.readOnly = false;
        tokenLockBtn.innerText = '🔓'; tokenLockBtn.title = 'Lock & Save';
        tokenInput.focus();
    }
};

document.getElementById('copyRepoBtn').onclick = () => {
    document.getElementById('repoUrl').select();
    document.execCommand('copy');
    alert('Repository link copied to clipboard!');
};

// --- MODAL CONTROLLER ---
const modal = document.getElementById('customModal');
function closeModal() { modal.classList.remove('active'); }

// --- 2. ROW BUILDER (For Instant UI Updates) ---
function buildRowHTML(file) {
    const isDisabled = file.name.startsWith("disabled_");
    const cleanName = isDisabled ? file.name.replace("disabled_", "") : file.name;
    const statusBadge = isDisabled ? `<span class="badge warning">Hidden</span>` : `<span class="badge success">Live</span>`;
    const safeName = file.name.replace(/'/g, "\\'"); 
    const fastThumbUrl = `https://wsrv.nl/?url=${encodeURIComponent(file.download_url)}&w=150&q=60&output=webp`;

    const actions = `
        <div class="action-buttons">
            <button onclick="openRenameModal('${safeName}', '${file.sha}', '${file.download_url}')" class="btn-mini btn-blue" title="Rename">✎</button>
            <button onclick="toggleVisibility('${safeName}', '${file.sha}', '${file.download_url}')" class="btn-mini btn-yellow" title="${isDisabled ? 'Show' : 'Hide'}">${isDisabled ? '👁️' : '🚫'}</button>
            <button onclick="openDeleteModal('${safeName}', '${file.sha}')" class="btn-mini btn-red" title="Delete">🗑️</button>
        </div>
    `;
    
    return `
        <td><img src="${fastThumbUrl}" class="admin-thumb" style="opacity: ${isDisabled ? 0.5 : 1}"></td>
        <td style="color: ${isDisabled ? '#888' : '#fff'}">${cleanName}</td>
        <td class="dim-cell">...</td>
        <td>${statusBadge}</td>
        <td>${actions}</td>
    `;
}

// --- 3. FAST LOAD IMAGES ---
async function loadImages() {
    const tableBody = document.getElementById('imageTableBody');
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Fetching repository data...</td></tr>`;
    
    try {
        // Cache-busting parameter added to force fresh list on manual refresh
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGE_FOLDER}?t=${Date.now()}`);
        if (!response.ok) throw new Error("Failed to fetch image list. Check repository status.");
        
        const data = await response.json();
        const images = data.filter(file => file.name.match(/\.(jpg|jpeg|png)$/i));

        tableBody.innerHTML = ""; 

        for (const file of images) {
            const row = document.createElement('tr');
            row.id = `row-${file.sha}`; // Unique ID for instant targeting
            row.innerHTML = buildRowHTML(file);
            tableBody.appendChild(row);
            
            // Fetch natural dimensions in background
            analyzeImage(file.download_url, row.querySelector('.dim-cell'));
        }
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error: ${error.message}</td></tr>`;
    }
}

function analyzeImage(url, cellElement) {
    const img = new Image(); img.crossOrigin = "Anonymous"; img.src = url;
    img.onload = function() { cellElement.innerText = `${img.naturalWidth} x ${img.naturalHeight}`; };
}

// --- 4. GITHUB API HELPER ---
async function githubRequest(endpoint, method = 'GET', body = null) {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) throw new Error("GitHub Token is empty or missing.");
    
    const options = {
        method: method,
        headers: { 
            'Authorization': `token ${token}`, 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/${endpoint}`, options);
    
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `API Error: ${response.status}`);
    }
    return response;
}

// --- 5. MODAL WORKFLOWS & INSTANT UPDATES ---

// A. DELETE WORKFLOW
function openDeleteModal(filename, sha) {
    document.getElementById('modalTitle').innerText = "Delete Image";
    document.getElementById('modalBody').innerHTML = `
        <p>Are you sure you want to permanently delete <strong>${filename}</strong>?</p>
        <p style="color:#ff3333; font-size:0.9rem; margin-top:5px;">This action cannot be undone.</p>
        <div id="modalStatus" style="margin-top:10px; font-weight:bold;"></div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="modal-btn btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="modal-btn btn-confirm" id="confirmActionBtn" onclick="executeDelete('${filename}', '${sha}')">Yes, Delete</button>
    `;
    modal.classList.add('active');
}

async function executeDelete(filename, sha) {
    const btn = document.getElementById('confirmActionBtn');
    const statusMsg = document.getElementById('modalStatus');
    btn.innerText = "Deleting..."; btn.disabled = true;
    statusMsg.innerHTML = `<span style="color:orange">Removing from GitHub...</span>`;
    
    try {
        await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(filename)}`, 'DELETE', { 
            message: `Delete ${filename} via Admin Panel`, sha: sha 
        });
        
        // INSTANT UI UPDATE: Remove the row from the table immediately
        document.getElementById(`row-${sha}`).remove();
        closeModal();
        
    } catch (err) {
        statusMsg.innerHTML = `<span style="color:red">Failed: ${err.message}</span>`;
        btn.innerText = "Yes, Delete"; btn.disabled = false;
    }
}

// B. RENAME WORKFLOW
function openRenameModal(oldName, sha, downloadUrl) {
    const lastDot = oldName.lastIndexOf('.');
    const baseName = oldName.substring(0, lastDot);
    const ext = oldName.substring(lastDot);

    document.getElementById('modalTitle').innerText = "Rename Image";
    document.getElementById('modalBody').innerHTML = `
        <label style="color:#888; font-size:0.9rem;">New Filename</label>
        <div class="rename-input-group">
            <input type="text" id="renameBaseInput" value="${baseName}" autocomplete="off">
            <span class="rename-ext">${ext}</span>
        </div>
        <div id="modalStatus" style="margin-top:10px; font-weight:bold;"></div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="modal-btn btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="modal-btn btn-save" id="confirmActionBtn" onclick="executeRename('${oldName}', '${ext}', '${sha}', '${downloadUrl}')">Save</button>
    `;
    modal.classList.add('active');
    
    setTimeout(() => {
        const input = document.getElementById('renameBaseInput');
        input.focus(); input.select();
    }, 100);
}

async function executeRename(oldName, ext, sha, downloadUrl) {
    const baseInput = document.getElementById('renameBaseInput').value.trim();
    if (!baseInput) { 
        document.getElementById('modalStatus').innerHTML = `<span style="color:red">Filename cannot be empty.</span>`; 
        return; 
    }
    
    const newName = baseInput + ext;
    if (newName === oldName) { closeModal(); return; }

    performRename(oldName, newName, sha, downloadUrl, "Saving rename...");
}

// C. TOGGLE VISIBILITY (Hide/Show)
async function toggleVisibility(filename, sha, downloadUrl) {
    const isHidden = filename.startsWith("disabled_");
    const newName = isHidden ? filename.replace("disabled_", "") : `disabled_${filename}`;
    
    performRename(filename, newName, sha, downloadUrl, "Toggling visibility...");
}

// D. UNIVERSAL RENAME ENGINE (Used by Rename & Toggle)
async function performRename(oldName, newName, oldSha, downloadUrl, loadingMsg) {
    const statusMsg = document.getElementById('modalStatus') || document.getElementById('uploadStatus');
    const btn = document.getElementById('confirmActionBtn');
    
    if(btn) { btn.innerText = "Processing..."; btn.disabled = true; }
    statusMsg.innerHTML = `<span style="color:orange">${loadingMsg}</span>`;

    try {
        // Download old file
        const fetchRes = await fetch(downloadUrl);
        if (!fetchRes.ok) throw new Error("Could not download original file data.");
        const blob = await fetchRes.blob();
        
        const reader = new FileReader(); 
        reader.readAsDataURL(blob);
        
        reader.onloadend = async function() {
            try {
                const base64data = reader.result.split(',')[1];
                
                // 1. Put New File
                const putRes = await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(newName)}`, 'PUT', { 
                    message: `Rename ${oldName} to ${newName}`, content: base64data 
                });
                const newFileData = await putRes.json();
                
                // 2. Delete Old File
                await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(oldName)}`, 'DELETE', { 
                    message: `Cleanup old file during rename`, sha: oldSha 
                });
                
                // 3. INSTANT UI UPDATE: Update the existing row with new data
                const row = document.getElementById(`row-${oldSha}`);
                row.id = `row-${newFileData.content.sha}`; // Update tracking ID
                row.innerHTML = buildRowHTML(newFileData.content); // Redraw buttons and text
                analyzeImage(newFileData.content.download_url, row.querySelector('.dim-cell'));
                
                if(modal.classList.contains('active')) closeModal();
                statusMsg.innerHTML = `<span style="color:#00ff00">Success!</span>`;
                setTimeout(() => statusMsg.innerHTML = '', 3000);

            } catch (apiErr) {
                statusMsg.innerHTML = `<span style="color:red">API Error: ${apiErr.message}</span>`;
                if(btn) { btn.innerText = "Save"; btn.disabled = false; }
            }
        };
    } catch (err) {
        statusMsg.innerHTML = `<span style="color:red">Error: ${err.message}</span>`;
        if(btn) { btn.innerText = "Save"; btn.disabled = false; }
    }
}

// --- 6. UPLOAD NEW IMAGE (Instant Update) ---
document.getElementById('fileInput').addEventListener('change', async function() {
    const file = this.files[0];
    const statusMsg = document.getElementById('uploadStatus');
    if (!file) return;

    try {
        const token = document.getElementById('githubToken').value.trim();
        if (!token) throw new Error("GitHub Token required.");
        localStorage.setItem('ecw_gh_token', token);

        statusMsg.innerHTML = `<span style="color:orange">Reading file...</span>`;

        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = async function() {
            try {
                const base64Content = reader.result.split(',')[1];
                statusMsg.innerHTML = `<span style="color:orange">Checking existing files...</span>`;

                let existingSha = null;
                try {
                    const checkRes = await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(file.name)}`, 'GET');
                    const existingFile = await checkRes.json();
                    existingSha = existingFile.sha;
                } catch (e) { }

                statusMsg.innerHTML = `<span style="color:orange">Uploading to GitHub...</span>`;
                const requestBody = { message: `Upload ${file.name}`, content: base64Content };
                if (existingSha) requestBody.sha = existingSha;

                const uploadRes = await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(file.name)}`, 'PUT', requestBody);
                const newFileData = await uploadRes.json();
                
                statusMsg.innerHTML = `<span style="color:#00ff00">Upload Complete!</span>`; 
                
                // INSTANT UI UPDATE: Add new row to top of table
                const tableBody = document.getElementById('imageTableBody');
                
                // Remove the "Loading" placeholder if it's the only row
                if(tableBody.innerText.includes('Fetching')) tableBody.innerHTML = '';
                
                // If overwritten, remove old row first
                if (existingSha) {
                    const oldRow = document.getElementById(`row-${existingSha}`);
                    if (oldRow) oldRow.remove();
                }

                const newRow = document.createElement('tr');
                newRow.id = `row-${newFileData.content.sha}`;
                newRow.innerHTML = buildRowHTML(newFileData.content);
                tableBody.prepend(newRow); // Add to top
                
                analyzeImage(newFileData.content.download_url, newRow.querySelector('.dim-cell'));
                
                setTimeout(() => statusMsg.innerHTML = '', 3000);

            } catch (err) { statusMsg.innerHTML = `<span style="color:red">Upload Failed: ${err.message}</span>`; }
        };
    } catch (error) { statusMsg.innerHTML = `<span style="color:red">${error.message}</span>`; }
});

// Start
loadImages();
