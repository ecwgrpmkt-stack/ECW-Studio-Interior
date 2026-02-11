// --- CONFIGURATION ---
const REPO_OWNER = 'ecwgrpmkt-stack';
const REPO_NAME = '360_gallery';
const ADMIN_USER = 'ECW';
const ADMIN_PASS = 'ecw123';

let currentRenameFile = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('gh_token');
    if (savedToken) {
        document.getElementById('gh-token').value = savedToken;
    }
    loadImages();
});

// --- SECTION 1: TOKEN LOCK LOGIC ---
const tokenInput = document.getElementById('gh-token');
const lockBtn = document.getElementById('lock-toggle');
const lockIcon = document.getElementById('lock-icon');

lockBtn.addEventListener('click', () => {
    if (tokenInput.readOnly) {
        // Unlock attempt
        const userPass = prompt("Enter Admin Password to modify settings:");
        if (userPass === ADMIN_PASS) {
            tokenInput.readOnly = false;
            tokenInput.type = "text";
            lockIcon.className = "fas fa-lock-open";
            lockBtn.classList.add('unlocked');
        } else {
            alert("Incorrect password!");
        }
    } else {
        // Locking
        tokenInput.readOnly = true;
        tokenInput.type = "password";
        lockIcon.className = "fas fa-lock";
        lockBtn.classList.remove('unlocked');
        localStorage.setItem('gh_token', tokenInput.value);
        alert("Token locked and saved.");
    }
});

// --- SECTION 2: SMART RENAME LOGIC ---
function openRenameModal(fileName) {
    currentRenameFile = fileName;
    const lastDot = fileName.lastIndexOf('.');
    const nameOnly = fileName.substring(0, lastDot);
    const extOnly = fileName.substring(lastDot);

    document.getElementById('new-name-input').value = nameOnly;
    document.getElementById('ext-display').innerText = extOnly;
    document.getElementById('rename-modal').style.display = 'flex';
}

function closeRenameModal() {
    document.getElementById('rename-modal').style.display = 'none';
}

document.getElementById('save-rename-btn').addEventListener('click', async () => {
    const newName = document.getElementById('new-name-input').value.trim();
    const ext = document.getElementById('ext-display').innerText;
    
    if (!newName) return alert("Please enter a name");
    
    const finalName = newName + ext;
    console.log(`Debug: Renaming ${currentRenameFile} to ${finalName}`);
    
    // GitHub API Move/Rename Logic (Simplified)
    await performRename(currentRenameFile, finalName);
    closeRenameModal();
    loadImages();
});

// --- SECTION 3: GITHUB API OPERATIONS ---
async function loadImages() {
    const token = tokenInput.value;
    if (!token) return;

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/images`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const data = await response.json();
        renderTable(data);
    } catch (err) {
        console.error("Debug: Load failed", err);
    }
}

function renderTable(files) {
    const tbody = document.getElementById('image-table-body');
    tbody.innerHTML = '';
    
    files.forEach(file => {
        if (file.type === 'file') {
            const row = `
                <tr>
                    <td><img src="${file.download_url}" class="img-preview"></td>
                    <td>${file.name}</td>
                    <td>
                        <button onclick="openRenameModal('${file.name}')"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteFile('${file.sha}', '${file.name}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        }
    });
}

async function performRename(oldName, newName) {
    const token = tokenInput.value;
    alert(`GitHub Logic: Moving ${oldName} to ${newName}. (Requires API PUT then DELETE)`);
    // Note: GitHub API rename is a 2-step process (Copy to new path, then Delete old path)
}

async function handleUpload() {
    const file = document.getElementById('file-input').files[0];
    if (!file) return alert("Select a file first");
    console.log("Debug: Starting upload for", file.name);
    // Add your base64 upload logic here
}
