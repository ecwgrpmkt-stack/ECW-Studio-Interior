// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";
const IMAGE_FOLDER = "images";

// 1. AUTH CHECK (Security Gate)
if (sessionStorage.getItem('ecw_auth') !== 'true') {
    window.location.href = 'index.html';
}

function logout() {
    sessionStorage.removeItem('ecw_auth');
    window.location.href = 'index.html';
}

// Restore Token if saved
const savedToken = localStorage.getItem('ecw_gh_token');
if (savedToken) document.getElementById('githubToken').value = savedToken;

// 2. LOAD IMAGES
async function loadImages() {
    const tableBody = document.getElementById('imageTableBody');
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Fetching data from GitHub...</td></tr>`;

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGE_FOLDER}`);
        if (!response.ok) throw new Error("Failed to fetch image list");
        
        const data = await response.json();
        const images = data.filter(file => file.name.match(/\.(jpg|jpeg|png)$/i));

        tableBody.innerHTML = ""; // Clear loader

        // Process each image
        for (const file of images) {
            const row = document.createElement('tr');
            
            // Generate optimized URL for analysis
            const imgUrl = file.download_url;
            
            row.innerHTML = `
                <td><div class="loader-mini"></div></td>
                <td>${file.name}</td>
                <td class="dim-cell">Analyzing...</td>
                <td class="type-cell">-</td>
                <td><span class="badge success">Active</span></td>
            `;
            
            tableBody.appendChild(row);

            // Analyze Image in Background
            analyzeImage(imgUrl, row);
        }

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error: ${error.message}</td></tr>`;
    }
}

// 3. ANALYZE IMAGE (Dimensions & Type)
function analyzeImage(url, rowElement) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;

    img.onload = function() {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const ratio = w / h;

        // Determine Type
        let type = "Unknown";
        let badgeClass = "secondary";
        
        if (ratio >= 1.9 && ratio <= 2.1) {
            type = "360° Sphere";
            badgeClass = "primary";
        } else if (ratio > 2.5) {
            type = "Panorama";
            badgeClass = "warning";
        } else {
            type = "Standard";
        }

        // Update Row HTML
        rowElement.innerHTML = `
            <td><img src="${url}" class="admin-thumb"></td>
            <td>${rowElement.cells[1].innerText}</td>
            <td>${w} x ${h} px</td>
            <td><span class="badge ${badgeClass}">${type}</span></td>
            <td><span class="badge success">Live</span></td>
        `;
    };
}

// 4. UPLOAD LOGIC
const fileInput = document.getElementById('fileInput');
const dropArea = document.getElementById('dropArea');

fileInput.addEventListener('change', handleUpload);

async function handleUpload() {
    const file = fileInput.files[0];
    const token = document.getElementById('githubToken').value.trim();
    const statusMsg = document.getElementById('uploadStatus');

    if (!file) return;

    if (!token) {
        statusMsg.innerHTML = `<span style="color:red;">Error: GitHub Token required.</span>`;
        return;
    }

    // Save token for next time
    localStorage.setItem('ecw_gh_token', token);

    statusMsg.innerHTML = "Reading file...";

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = async function() {
        const base64Content = reader.result.split(',')[1];
        statusMsg.innerHTML = "Uploading to GitHub...";

        try {
            const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGE_FOLDER}/${file.name}`;
            
            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Upload ${file.name} via Admin Panel`,
                    content: base64Content
                })
            });

            if (response.ok) {
                statusMsg.innerHTML = `<span style="color:#00ff00;">Success! Image Uploaded.</span>`;
                loadImages(); // Refresh List
            } else {
                const err = await response.json();
                throw new Error(err.message);
            }

        } catch (error) {
            statusMsg.innerHTML = `<span style="color:red;">Upload Failed: ${error.message}</span>`;
        }
    };
}

// Start
loadImages();