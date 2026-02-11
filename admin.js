// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";
const IMAGE_FOLDER = "images";

// AUTH CHECK
if (sessionStorage.getItem('ecw_auth') !== 'true') window.location.href = 'index.html';

function logout() { sessionStorage.removeItem('ecw_auth'); window.location.href = 'index.html'; }
const savedToken = localStorage.getItem('ecw_gh_token');
if (savedToken) document.getElementById('githubToken').value = savedToken;

async function loadImages() {
    const tableBody = document.getElementById('imageTableBody');
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Fetching repository data...</td></tr>`;
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGE_FOLDER}`);
        if (!response.ok) throw new Error("Failed to fetch image list");
        
        const data = await response.json();
        const images = data.filter(file => file.name.match(/\.(jpg|jpeg|png)$/i));

        tableBody.innerHTML = ""; 

        for (const file of images) {
            const row = document.createElement('tr');
            const isDisabled = file.name.startsWith("disabled_");
            const cleanName = isDisabled ? file.name.replace("disabled_", "") : file.name;
            const statusBadge = isDisabled ? `<span class="badge warning">Hidden</span>` : `<span class="badge success">Live</span>`;
            
            const actions = `
                <div class="action-buttons">
                    <button onclick="renameFile('${file.name}', '${file.sha}')" class="btn-mini btn-blue" title="Rename">✎</button>
                    <button onclick="toggleVisibility('${file.name}', '${file.sha}')" class="btn-mini btn-yellow" title="${isDisabled ? 'Show' : 'Hide'}">${isDisabled ? '👁️' : '🚫'}</button>
                    <button onclick="deleteFile('${file.name}', '${file.sha}')" class="btn-mini btn-red" title="Delete">🗑️</button>
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

async function githubRequest(endpoint, method = 'GET', body = null) {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) { alert("Please enter your GitHub Token first."); return null; }
    
    const options = {
        method: method,
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/${endpoint}`, options);
    return response;
}

async function deleteFile(filename, sha) {
    if (!confirm(`Permanently DELETE "${filename}"?`)) return;
    const btn = event.target; btn.innerText = "⏳"; btn.disabled = true;
    const res = await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(filename)}`, 'DELETE', { message: `Delete ${filename}`, sha: sha });
    if (res && res.ok) loadImages();
    else { 
        const err = await res.json();
        alert("Delete failed: " + err.message); 
        btn.innerText = "🗑️"; btn.disabled = false; 
    }
}

async function toggleVisibility(filename, sha) {
    const isHidden = filename.startsWith("disabled_");
    const newName = isHidden ? filename.replace("disabled_", "") : `disabled_${filename}`;
    performRename(filename, newName, sha, "Toggling Visibility...");
}

async function renameFile(oldName, sha) {
    const newName = prompt("Enter new filename:", oldName);
    if (!newName || newName === oldName) return;
    if (!newName.match(/\.(jpg|jpeg|png)$/i)) { alert("Filename must end with .jpg, .jpeg, or .png"); return; }
    performRename(oldName, newName, sha, "Renaming File...");
}

async function performRename(oldName, newName, sha, loadingMsg) {
    const statusMsg = document.getElementById('uploadStatus');
    statusMsg.innerHTML = `<span style="color:orange">${loadingMsg} (Please wait)</span>`;

    try {
        const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${IMAGE_FOLDER}/${encodeURIComponent(oldName)}`;
        const fetchRes = await fetch(rawUrl);
        const blob = await fetchRes.blob();
        
        const reader = new FileReader(); reader.readAsDataURL(blob);
        reader.onloadend = async function() {
            const base64data = reader.result.split(',')[1];
            
            const putRes = await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(newName)}`, 'PUT', { message: `Rename ${oldName} to ${newName}`, content: base64data });
            if (!putRes.ok) throw new Error("Failed to create new file.");
            
            const delRes = await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(oldName)}`, 'DELETE', { message: `Cleanup old file`, sha: sha });
            if (delRes.ok) { statusMsg.innerHTML = `<span style="color:#00ff00">Success!</span>`; loadImages(); }
            else { throw new Error("Created new file but failed to delete old one."); }
        };
    } catch (err) {
        statusMsg.innerHTML = `<span style="color:red">Error: ${err.message}</span>`;
    }
}

// --- 4. IMPROVED UPLOAD LOGIC ---
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', handleUpload);

async function handleUpload() {
    const file = fileInput.files[0];
    const token = document.getElementById('githubToken').value.trim();
    const statusMsg = document.getElementById('uploadStatus');

    if (!file || !token) { statusMsg.innerHTML = `<span style="color:red">Error: Missing File or Token</span>`; return; }
    
    localStorage.setItem('ecw_gh_token', token);
    statusMsg.innerHTML = `<span style="color:orange">Reading file...</span>`;

    const reader = new FileReader(); 
    reader.readAsDataURL(file);
    
    reader.onload = async function() {
        const base64Content = reader.result.split(',')[1];
        statusMsg.innerHTML = `<span style="color:orange">Checking repository...</span>`;

        try {
            // 1. Check if the file already exists (so we can overwrite it)
            let existingSha = null;
            const checkRes = await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(file.name)}`, 'GET');
            if (checkRes && checkRes.ok) {
                const existingFile = await checkRes.json();
                existingSha = existingFile.sha;
            }

            // 2. Upload the file
            statusMsg.innerHTML = `<span style="color:orange">Uploading to GitHub...</span>`;
            const requestBody = { 
                message: `Upload ${file.name} via Admin Panel`, 
                content: base64Content 
            };
            
            // If the file exists, GitHub strictly requires the old SHA to allow overwrite
            if (existingSha) requestBody.sha = existingSha;

            const res = await githubRequest(`contents/${IMAGE_FOLDER}/${encodeURIComponent(file.name)}`, 'PUT', requestBody);
            
            if (res && res.ok) { 
                statusMsg.innerHTML = `<span style="color:#00ff00">Success! Image Uploaded.</span>`; 
                loadImages(); 
            } else { 
                // Capture the exact error from GitHub to display to the user
                const errData = await res.json();
                throw new Error(errData.message || "Unknown GitHub API Error");
            }
        } catch (error) {
            statusMsg.innerHTML = `<span style="color:red">Upload Failed: ${error.message}</span>`;
            console.error("Upload Error Details:", error);
        }
    };
}

// Initialize
loadImages();
