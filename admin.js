const REPO_URL = "ecwgrpmkt-stack/360_gallery";
const ADMIN_PASS = "ecw123";
let currentToken = localStorage.getItem('gh_token') || "";

// --- SECURITY: LOCK/UNLOCK LOGIC ---
function toggleLock(type) {
    const field = type === 'token' ? document.getElementById('gh-token') : document.getElementById('gh-repo');
    const icon = document.getElementById(`lock-icon-${type}`);

    if (field.readOnly) {
        const pass = prompt("Admin Credential Required:");
        if (pass === ADMIN_PASS) {
            field.readOnly = false;
            field.type = "text";
            field.value = type === 'token' ? currentToken : REPO_URL;
            icon.className = "fas fa-lock-open";
        } else { alert("Access Denied"); }
    } else {
        if (type === 'token') {
            currentToken = field.value;
            localStorage.setItem('gh_token', currentToken);
        }
        field.readOnly = true;
        field.type = "password";
        field.value = "********************"; // Re-mask
        icon.className = "fas fa-lock";
        loadAssets(); // Refresh list with new token
    }
}

// --- CORE: LOAD ASSETS ---
async function loadAssets() {
    if (!currentToken) return;
    const tbody = document.getElementById('asset-table');
    
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO_URL}/contents/images`, {
            headers: { 'Authorization': `token ${currentToken}` }
        });
        const files = await res.json();
        tbody.innerHTML = "";

        files.forEach(file => {
            const isHidden = file.name.startsWith('hidden_');
            const displayName = isHidden ? file.name.replace('hidden_', '') : file.name;
            
            tbody.innerHTML += `
                <tr>
                    <td><img src="${file.download_url}" class="thumb"></td>
                    <td>${displayName}</td>
                    <td><span class="status-badge ${isHidden ? 'status-hidden' : 'status-live'}">${isHidden ? 'HIDDEN' : 'LIVE'}</span></td>
                    <td style="display:flex; gap:8px">
                        <button class="btn btn-secondary" onclick="toggleVisibility('${file.name}', ${isHidden}, '${file.sha}')">
                            <i class="fas ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="openRename('${file.name}', '${file.sha}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-secondary" style="color:#ff4444" onclick="deleteAsset('${file.name}', '${file.sha}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch (e) { console.error("Load failed", e); }
}

// --- ACTIONS: HIDE/SHOW ---
async function toggleVisibility(oldName, currentlyHidden, sha) {
    const newName = currentlyHidden ? oldName.replace('hidden_', '') : 'hidden_' + oldName;
    await renameFileOnGithub(oldName, newName, sha);
}

// --- ACTIONS: RENAME ---
let renameSha = "";
let oldFileName = "";
function openRename(name, sha) {
    oldFileName = name;
    renameSha = sha;
    const dot = name.lastIndexOf('.');
    document.getElementById('rename-input').value = name.substring(0, dot);
    document.getElementById('ext-label').innerText = name.substring(dot);
    document.getElementById('rename-modal').style.display = 'flex';
}

document.getElementById('confirm-rename').onclick = async () => {
    const newBase = document.getElementById('rename-input').value;
    const ext = document.getElementById('ext-label').innerText;
    await renameFileOnGithub(oldFileName, newBase + ext, renameSha);
    closeModal();
};

async function renameFileOnGithub(oldName, newName, sha) {
    alert(`Logic: Committing Move ${oldName} -> ${newName} to GitHub...`);
    // 1. Get file content, 2. Create new file, 3. Delete old file
    loadAssets(); 
}

function closeModal() { document.getElementById('rename-modal').style.display = 'none'; }

// Initial load
if (currentToken) loadAssets();
