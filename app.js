// ==========================================
// ECW 360 GALLERY - FRONTEND APPLICATION
// ==========================================

// --- CONFIGURATION ---
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";
const IMAGE_FOLDER = "images";
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGE_FOLDER}`;

// Global Application State
let viewer = null;
let visibleImages = [];
let currentIndex = 0;

// Timers for UX features
let idleTimer;
let autoPlayTimer;
const IDLE_TIME_MS = 3000;    // 3 seconds before showing the interaction hint
const AUTOPLAY_TIME_MS = 60000; // 60 seconds of inactivity before switching image

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    showLoader();
    await loadGalleryData();
    
    if (visibleImages.length > 0) {
        initViewer(visibleImages[0].download_url);
        renderThumbnails();
    } else {
        hideLoader();
        document.getElementById('panorama').innerHTML = "<h2 style='color:white; text-align:center; padding-top:20%; font-family:sans-serif;'>No public images available.</h2>";
    }
});

// --- 2. CORE LOGIC: FETCH & FILTER GITHUB IMAGES ---
async function loadGalleryData() {
    try {
        const response = await fetch(GITHUB_API_URL);
        if (!response.ok) throw new Error("Failed to fetch from GitHub API");
        
        const allFiles = await response.json();
        
        // ---------------------------------------------------------
        // THE CRITICAL SECURITY FILTER
        // This ensures the public never sees files starting with "hidden_"
        // ---------------------------------------------------------
        visibleImages = allFiles.filter(file => {
            return file.type === "file" && 
                   file.name.match(/\.(jpg|jpeg|png|webp)$/i) && 
                   !file.name.startsWith('hidden_');
        });

        console.log(`Successfully loaded ${visibleImages.length} public images.`);
    } catch (error) {
        console.error("Gallery Load Error:", error);
    }
}

// --- 3. PANNELLUM VIEWER INTEGRATION ---
function initViewer(imageUrl) {
    if (viewer) {
        viewer.destroy(); // Destroy existing instance before loading a new one
    }

    viewer = pannellum.viewer('panorama', {
        "type": "equirectangular",
        "panorama": imageUrl,
        "autoLoad": true,
        "showControls": false, // Custom controls handled via HTML/CSS if needed
        "mouseZoom": true,
        "keyboardZoom": true
    });

    // When Pannellum finishes rendering the image
    viewer.on('load', () => {
        hideLoader();
        startTimers();
    });

    // Detect user interactions inside the 360 canvas
    viewer.on('mousedown', startTimers);
    viewer.on('touchstart', startTimers);
}

function switchScene(index) {
    if (index === currentIndex) return; // Don't reload if clicking the same image
    
    currentIndex = index;
    const nextImage = visibleImages[currentIndex];
    
    showLoader();
    initViewer(nextImage.download_url);
    updateActiveThumbnail();
}

// --- 4. THUMBNAIL RENDERING ---
function renderThumbnails() {
    const container = document.getElementById('thumbnail-container'); // Make sure this ID exists in your gallery.html
    if (!container) return;
    
    container.innerHTML = ""; // Clear existing

    visibleImages.forEach((img, index) => {
        const thumbBtn = document.createElement('div');
        thumbBtn.className = `thumbnail ${index === 0 ? 'active' : ''}`;
        thumbBtn.onclick = () => switchScene(index);

        const imgElement = document.createElement('img');
        // Using GitHub download URL directly. For faster loading, you could route this through a CDN like jsDelivr
        imgElement.src = img.download_url; 
        imgElement.alt = img.name;

        thumbBtn.appendChild(imgElement);
        container.appendChild(thumbBtn);
    });
}

function updateActiveThumbnail() {
    const thumbnails = document.querySelectorAll('.thumbnail');
    thumbnails.forEach((thumb, index) => {
        if (index === currentIndex) {
            thumb.classList.add('active');
        } else {
            thumb.classList.remove('active');
        }
    });
}

// --- 5. IDLE & AUTOPLAY UX LOGIC ---
function startTimers() {
    clearTimeout(idleTimer);
    clearTimeout(autoPlayTimer);
    
    hideInteractionHint();
    
    // Set Idle Hint (e.g., the pulsing hand icon)
    idleTimer = setTimeout(showInteractionHint, IDLE_TIME_MS);
    
    // Set Auto-Play (moves to next image if user walks away)
    autoPlayTimer = setTimeout(autoPlayNext, AUTOPLAY_TIME_MS);
}

function autoPlayNext() {
    if (visibleImages.length <= 1) return;
    let nextIndex = (currentIndex + 1) % visibleImages.length;
    switchScene(nextIndex);
}

// --- UI HELPERS ---
function showLoader() {
    const loader = document.getElementById('ecw-loader'); // Ensure this matches your ECW loader ID in HTML
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('ecw-loader');
    if (loader) {
        // ECW-branded 2-second transition timeout if desired
        setTimeout(() => { loader.style.display = 'none'; }, 500); 
    }
}

function showInteractionHint() {
    const hint = document.getElementById('interaction-hint');
    if (hint) hint.classList.remove('hidden');
}

function hideInteractionHint() {
    const hint = document.getElementById('interaction-hint');
    if (hint) hint.classList.add('hidden');
}

// Global Interaction Listeners to reset timers
window.addEventListener('mousemove', startTimers);
window.addEventListener('keydown', startTimers);
window.addEventListener('touchstart', startTimers);
