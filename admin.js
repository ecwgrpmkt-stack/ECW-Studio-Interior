// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";
const IMAGE_FOLDER = "images";

// 1. AUTH & INIT
if (sessionStorage.getItem('ecw_auth') !== 'true') window.location.href = 'index.html';
function logout() { sessionStorage.removeItem('ecw_auth'); window.location.href = 'index.html'; }

// 2. UI FUNCTIONALITY: Token Lock & Copy Repo
const tokenInput = document.getElementById('githubToken');
const tokenLockBtn = document.getElementById('tokenLockBtn');
let isTokenLocked = true;

// Load saved token on startup
const savedToken = localStorage.getItem('ecw_gh_token');
if (savedToken) tokenInput.value = savedToken;

tokenLockBtn.onclick = () => {
    isTokenLocked = !isTokenLocked;
    if (isTokenLocked) {
        tokenInput.type = 'password';
        tokenInput.readOnly = true;
        tokenLockBtn.innerText = '🔒';
        tokenLockBtn.title = 'Unlock to Edit';
        localStorage.setItem('ecw_gh_token', tokenInput.value.trim()); // Save when locked
    } else {
        tokenInput.type = 'text';
        tokenInput.readOnly = false;
        tokenLockBtn.innerText = '🔓';
        tokenLockBtn.title = 'Lock & Save';
        tokenInput.focus();
    }
};

document.getElementById('copyRepoBtn').onclick = () => {
    const repoUrl = document.getElementById('repoUrl');
    repoUrl.select();
    document.execCommand('copy');
    alert('Repository link copied to clipboard!');
};

// 3. LOAD IMAGES
async function loadImages() {
    const tableBody = document.getElementById('imageTableBody');
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Fetching repository data...</td></tr>`;
    
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGE_FOLDER}`);
        if (!response.ok) throw new Error("Failed to fetch image list. Check repository status.");
        
        const data = await response.json();
        const images = data.filter(file => file.name.match(/\.(jpg|jpeg|png)$/i));

        tableBody.innerHTML = ""; 

        for (const file of images) {
            const row = document.createElement('tr');
            const isDisabled = file.name.startsWith("disabled_");
            const cleanName = isDisabled ? file.name.replace("disabled_", "") : file.name;
            const statusBadge = isDisabled ? `<span class="badge warning">Hidden</span>` : `<span class="badge success">Live</span>`;
            
            // Pass download_url directly to avoid raw.github CORS issues
            const safeName = file.name.replace(/'/g, "\\'"); // escape single quotes
            const actions = `
                <div class="action-buttons">
                    <button onclick="renameFile('${safeName}', '${file.sha}', '${file.download_url}')" class="btn-mini btn-blue" title="Rename">✎</button>
                    <button onclick="toggleVisibility('${safeName}', '${file.sha}', '${file.download_url}')" class="btn-mini btn-yellow" title="${isDisabled ? 'Show' : 'Hide'}">${isDisabled ? '👁️' : '🚫'}</button>
                    <button onclick="deleteFile('${safeName}', '${file.sha}')" class="btn-mini btn-red" title="Delete">🗑️</button>
                </div>
            `;
            
            row.innerHTML = `
                <td><img src="${file.download_url}" class="admin-thumb" style="opacity: ${isDisabled ? 0.5 : 1}"></td>
                <td style="color: ${isDisabled ? '#888' : '#fff'}">${cleanName}</td>
                <td class="dim-cell">...</td>
                <td>${statusBadge}</td>
                <td>${actions}</td>
            `;
            tableBody.appendChild(row);
            analyzeImage(file.download_url, row);
        }
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error: ${error.message}</td></tr>`;
    }
}

function analyzeImage(url, rowElement) {
    const img = new Image(); img.crossOrigin = "Anonymous"; img.src = url;
    img.onload = function() { rowElement.cells[2].innerText = `${img.naturalWidth} x ${img.naturalHeight}`; };
}

// 4. GITHUB API HELPER
async function githubRequest(endpoint, method = 'GET', body = null) {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) throw new Error("GitHub Token is empty or missing.");
    
    const options = {
        method: method,
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/${endpoint}`, options);
    
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `API Error: ${response.status}`);
    }
    return response;
}

// 5. BACKEND ACTIONS (Debugged)

async function deleteFile(filename, sha) {
    if (!confirm(`Permanently DELETE "${filename}"?`)) return;
    const btn = event.target; btn.innerText = "⏳"; btn.disabled = true;
    
    try {
        await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(filename)}`, 'DELETE', { 
            message: `Delete ${filename} via Admin Panel`, 
            sha: sha 
        });
        loadImages(); // Refresh
    } catch (err) {
        alert("Delete failed: " + err.message);
        btn.innerText = "🗑️"; btn.disabled = false;
    }
}

async function toggleVisibility(filename, sha, downloadUrl) {
    const isHidden = filename.startsWith("disabled_");
    const newName = isHidden ? filename.replace("disabled_", "") : `disabled_${filename}`;
    performRename(filename, newName, sha, downloadUrl, "Toggling Visibility...");
}

async function renameFile(oldName, sha, downloadUrl) {
    const newName = prompt("Enter new filename:", oldName);
    if (!newName || newName === oldName) return;
    if (!newName.match(/\.(jpg|jpeg|png)$/i)) { alert("Filename must end with .jpg, .jpeg, or .png"); return; }
    performRename(oldName, newName, sha, downloadUrl, "Renaming File...");
}

// The core rename engine (Requires fetching old file, uploading new, deleting old)
async function performRename(oldName, newName, sha, downloadUrl, loadingMsg) {
    const statusMsg = document.getElementById('uploadStatus');
    statusMsg.innerHTML = `<span style="color:orange">${loadingMsg} (Please wait)</span>`;

    try {
        // Fetch content directly from the safe download URL
        const fetchRes = await fetch(downloadUrl);
        if (!fetchRes.ok) throw new Error("Could not download original file data.");
        const blob = await fetchRes.blob();
        
        const reader = new FileReader(); 
        reader.readAsDataURL(blob);
        
        reader.onloadend = async function() {
            try {
                const base64data = reader.result.split(',')[1];
                
                // Put new file
                await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(newName)}`, 'PUT', { 
                    message: `Rename ${oldName} to ${newName}`, 
                    content: base64data 
                });
                
                // Delete old file
                await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(oldName)}`, 'DELETE', { 
                    message: `Cleanup old file during rename`, 
                    sha: sha 
                });
                
                statusMsg.innerHTML = `<span style="color:#00ff00">Success!</span>`;
                loadImages();

            } catch (apiErr) {
                statusMsg.innerHTML = `<span style="color:red">Rename Error: ${apiErr.message}</span>`;
            }
        };
    } catch (err) {
        statusMsg.innerHTML = `<span style="color:red">Error: ${err.message}</span>`;
    }
}

// 6. UPLOAD NEW IMAGE
document.getElementById('fileInput').addEventListener('change', async function() {
    const file = this.files[0];
    const statusMsg = document.getElementById('uploadStatus');
    if (!file) return;

    try {
        const token = document.getElementById('githubToken').value.trim();
        if (!token) throw new Error("GitHub Token required.");
        localStorage.setItem('ecw_gh_token', token);

        statusMsg.innerHTML = `<span style="color:orange">Reading file...</span>`;

        const reader = new FileReader(); 
        reader.readAsDataURL(file);
        
        reader.onload = async function() {
            try {
                const base64Content = reader.result.split(',')[1];
                statusMsg.innerHTML = `<span style="color:orange">Checking if file exists...</span>`;

                let existingSha = null;
                try {
                    // Test if file exists
                    const checkRes = await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(file.name)}`, 'GET');
                    const existingFile = await checkRes.json();
                    existingSha = existingFile.sha;
                } catch (e) { /* File doesn't exist, which is fine */ }

                statusMsg.innerHTML = `<span style="color:orange">Uploading...</span>`;
                const requestBody = { 
                    message: `Upload ${file.name} via Admin Panel`, 
                    content: base64Content 
                };
                if (existingSha) requestBody.sha = existingSha; // Overwrite if exists

                await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(file.name)}`, 'PUT', requestBody);
                
                statusMsg.innerHTML = `<span style="color:#00ff00">Upload Complete!</span>`; 
                loadImages();

            } catch (err) {
                statusMsg.innerHTML = `<span style="color:red">Upload Failed: ${err.message}</span>`;
            }
        };
    } catch (error) {
        statusMsg.innerHTML = `<span style="color:red">${error.message}</span>`;
    }
});

// Start
loadImages();
