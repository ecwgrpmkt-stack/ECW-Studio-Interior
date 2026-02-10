// CONFIGURATION: GitHub Repository Details
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";
const BRANCH_NAME = "main"; 
const IMAGE_FOLDER_PATH = "images";

// We will populate this array dynamically
let images = []; 

let currentIndex = 0;
let viewer = null;
let activeImageSrc = null;

// TIMERS
let idleTimer = null;
let slideTimer = null;
const IDLE_DELAY = 3000;       
const AUTO_PLAY_DELAY = 60000; 

// --- 1. INITIALIZATION: Fetch Images from GitHub ---

async function initGallery() {
    try {
        console.log("Fetching image list from GitHub...");
        const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGE_FOLDER_PATH}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);
        
        const data = await response.json();

        // Filter and Format the data
        images = data
            .filter(file => file.name.match(/\.(jpg|jpeg|png)$/i))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}))
            .map(file => {
                // 1. Get the fast CDN source for the original file
                const rawCdnSrc = `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${BRANCH_NAME}/${file.path}`;
                
                // 2. APPLY RESOLUTION LIMIT (Device Support Fix)
                // &w=8000  -> Resize width to 8000px (Height scales automatically)
                // &we      -> "Without Enlargement" (If image is small, don't stretch it)
                // &q=85    -> High quality (85%) to keep 360 details sharp
                const optimizedSrc = `https://wsrv.nl/?url=${encodeURIComponent(rawCdnSrc)}&w=8000&we&q=85&output=webp`;

                return { 
                    src: optimizedSrc,
                    originalPath: rawCdnSrc // Keep reference just in case
                };
            });

        if (images.length === 0) {
            alert("No images found in the GitHub repository folder.");
            return;
        }

        console.log(`Loaded ${images.length} images.`);
        
        // Start the App
        buildThumbnails();
        loadViewer(currentIndex);

    } catch (error) {
        console.error("Failed to load images:", error);
        alert("Could not load images. Check console.");
    }
}

// --- MAIN VIEWER LOGIC ---

function loadViewer(index) {
    if (images.length === 0) return;

    const imgData = images[index];
    activeImageSrc = imgData.src;

    // Pre-load Image to analyze dimensions
    const tempImg = new Image();
    tempImg.crossOrigin = "Anonymous"; 
    tempImg.src = imgData.src;
    
    tempImg.onload = function() {
        if (tempImg.src.indexOf(activeImageSrc) === -1) return;

        const aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
        detectAndSetupScene(aspectRatio, imgData.src);
        
        preloadNextImage(index);
    };
    
    tempImg.onerror = function() {
        console.error("Error loading image:", imgData.src);
    };
}

// Helper to pre-load the next image for instant transition
function preloadNextImage(currentIndex) {
    const nextIndex = (currentIndex + 1) % images.length;
    const preloadImg = new Image();
    preloadImg.crossOrigin = "Anonymous";
    preloadImg.src = images[nextIndex].src;
}

function detectAndSetupScene(aspectRatio, imageSrc) {
    if (viewer) {
        viewer.destroy();
    }

    let config = {
        type: "equirectangular",
        panorama: imageSrc,
        autoLoad: true,
        showControls: false,
        crossOrigin: "anonymous", 
        yaw: 0,
        pitch: 0,
        autoRotate: 0 
    };

    // --- LOGIC: Detect Projection Type ---
    const isFullSphere = aspectRatio >= 1.9 && aspectRatio <= 2.1;

    if (isFullSphere) {
        // TYPE A: FULL 360 SPHERE
        updateBadge("360");
        config.haov = 360;
        config.vaov = 180;
        config.hfov = 100;
        config.minHfov = 50;
        config.maxHfov = 120;
    } else {
        // TYPE B: CYLINDRICAL / PARTIAL PANORAMA
        updateBadge("pano");

        const assumedVerticalFOV = 60; 
        let calculatedHorizontalFOV = assumedVerticalFOV * aspectRatio;

        if (calculatedHorizontalFOV > 360) calculatedHorizontalFOV = 360;

        config.haov = calculatedHorizontalFOV;  
        config.vaov = assumedVerticalFOV;       
        config.vOffset = 0;           
        
        if (calculatedHorizontalFOV < 360) {
            const halfWidth = calculatedHorizontalFOV / 2;
            config.minYaw = -halfWidth;
            config.maxYaw = halfWidth;
        }

        config.minPitch = -assumedVerticalFOV / 2;
        config.maxPitch = assumedVerticalFOV / 2;
        config.hfov = assumedVerticalFOV; 
        config.minHfov = 30;
        config.maxHfov = assumedVerticalFOV + 20; 
    }

    viewer = pannellum.viewer('viewer', config);

    // Attach Idle Events
    const viewerContainer = document.getElementById('viewer');
    viewerContainer.onmousedown = resetIdleTimer;
    viewerContainer.ontouchstart = resetIdleTimer;
    viewerContainer.onmouseup = startIdleCountdown;
    viewerContainer.ontouchend = startIdleCountdown;

    updateThumbs();
    startIdleCountdown();
}

function updateBadge(type) {
    const badge = document.getElementById('badge360');
    if (type === "360") {
        badge.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M21.5 12a9.5 9.5 0 1 1-9.5-9.5"/>
                <path d="M12 7v5l3 3"/>
                <circle cx="12" cy="12" r="2"/>
            </svg>
            <span>360° View</span>
        `;
    } else {
        badge.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <rect x="2" y="8" width="20" height="8" rx="2"></rect>
                <line x1="2" y1="12" x2="22" y2="12" stroke-dasharray="2 2"></line>
            </svg>
            <span>Panorama View</span>
        `;
    }
}

// --- TRANSITION EFFECT ---
function transitionToImage(index) {
    const overlay = document.getElementById('fade
