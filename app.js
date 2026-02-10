// CONFIGURATION: GitHub Repository Details
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";
const BRANCH_NAME = "main"; // Change to 'master' if your default branch is master
const IMAGE_FOLDER_PATH = "images";

// We will populate this array dynamically
let images = []; 

let currentIndex = 0;
let viewer = null;
let activeImageSrc = null;

// TIMERS
let idleTimer = null;
let slideTimer = null;
const IDLE_DELAY = 3000;       // 3 seconds before showing hand/zooming out
const AUTO_PLAY_DELAY = 60000; // 60 seconds before auto-advancing

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
            .filter(file => file.name.match(/\.(jpg|jpeg|png)$/i)) // Only images
            .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'})) // Natural sort
            .map(file => {
                // 1. Get the fast CDN source for the original file
                const rawCdnSrc = `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${BRANCH_NAME}/${file.path}`;
                
                // 2. APPLY RESOLUTION LIMIT (Device Support Fix)
                // &w=8000  -> Resize width to 8000px MAX
                // &we      -> "Without Enlargement" (If image is small, don't stretch it)
                // &q=85    -> High quality (85%) to keep 360 details sharp
                // &output=webp -> Smaller file size
                const optimizedSrc = `https://wsrv.nl/?url=${encodeURIComponent(rawCdnSrc)}&w=8000&we&q=85&output=webp`;

                return { 
                    src: optimizedSrc,
                    originalPath: rawCdnSrc // Keep reference for thumbnails
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
        // Prevent loading if user switched image while this was processing
        if (tempImg.src.indexOf(activeImageSrc) === -1) return;

        const aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
        detectAndSetupScene(aspectRatio, imgData.src);
        
        // OPTIMIZATION: Pre-load the NEXT image in the background
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
    
    // Standard 360 Sphere is 2:1 (approx 2.0)
    const isFullSphere = aspectRatio >= 1.9 && aspectRatio <= 2.1;

    if (isFullSphere) {
        // --- TYPE A: FULL 360 SPHERE ---
        updateBadge("360");
        config.haov = 360; // Full Horizontal
        config.vaov = 180; // Full Vertical
        config.hfov = 100; // Default Zoom
        config.minHfov = 50;
        config.maxHfov = 120;
    } else {
        // --- TYPE B: CYLINDRICAL / PARTIAL PANORAMA ---
        updateBadge("pano");

        // Assume standard vertical FOV for phone cameras (approx 60 degrees)
        const assumedVerticalFOV = 60; 
        
        // Calculate exact Horizontal degrees based on aspect ratio
        // Formula: Horizontal = Vertical * AspectRatio
        let calculatedHorizontalFOV = assumedVerticalFOV * aspectRatio;

        // Cap at 360 just in case
        if (calculatedHorizontalFOV > 360) calculatedHorizontalFOV = 360;

        config.haov = calculatedHorizontalFOV;  
        config.vaov = assumedVerticalFOV;       
        config.vOffset = 0;           
        
        // SEAM PREVENTION: 
        // If image is less than 360 deg, restrict Yaw so it stops at edges.
        if (calculatedHorizontalFOV < 360) {
            const halfWidth = calculatedHorizontalFOV / 2;
            config.minYaw = -halfWidth;
            config.maxYaw = halfWidth;
        }

        // Lock Vertical limits (prevent looking at black bars)
        config.minPitch = -assumedVerticalFOV / 2;
        config.maxPitch = assumedVerticalFOV / 2;
        
        // Adjust Zoom for Pano
        config.hfov = assumedVerticalFOV; 
        config.minHfov = 30;
        config.maxHfov = assumedVerticalFOV + 20; 
    }

    // Initialize Viewer
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
        // Panorama Icon
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
    const overlay = document.getElementById('fadeOverlay');
    
    // 1. Fade Out
    overlay.classList.add('active');

    // 2. Wait, then Load
    setTimeout(() => {
        currentIndex = index;
        loadViewer(currentIndex);

        // 3. Fade In
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 500); 
    }, 500);
}

// --- THUMBNAIL LOGIC ---
function buildThumbnails() {
    const panel = document.getElementById("thumbPanel");
    panel.innerHTML = "";

    images.forEach((img, i) => {
        const thumb = document.createElement("img");
        
        // THUMBNAIL OPTIMIZATION (Tiny size for sidebar)
        // Keep this at 200px width for speed
        const thumbUrl = `https://wsrv.nl/?url=${encodeURIComponent(img.originalPath)}&w=200&q=70&output=webp`;

        thumb.src = thumbUrl;
        thumb.className = "thumb";
        thumb.crossOrigin = "Anonymous"; 
        
        thumb.onclick = () => {
            resetIdleTimer();
            transitionToImage(i);
        };
        panel.appendChild(thumb);
    });
}

function updateThumbs() {
    document.querySelectorAll(".thumb").forEach((t, i) => {
        t.classList.toggle("active", i === currentIndex);
        if(i === currentIndex) {
            t.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    });
}

// --- IDLE & AUTO-PLAY SYSTEM ---

function startIdleCountdown() {
    clearTimeout(idleTimer);
    clearTimeout(slideTimer);

    // Timer 1: Show Hand & Zoom Out
    idleTimer = setTimeout(onIdleStart, IDLE_DELAY);

    // Timer 2: Auto-Advance Slide
    slideTimer = setTimeout(onAutoPlayNext, AUTO_PLAY_DELAY);
}

function resetIdleTimer() {
    // User interacted
    clearTimeout(idleTimer);
    clearTimeout(slideTimer);
    document.getElementById('idleIndicator').classList.remove('visible');
    if (viewer) viewer.stopAutoRotate();
}

function onIdleStart() {
    document.getElementById('idleIndicator').classList.add('visible');
    if (viewer) {
        // Safely get max zoom out level
        const maxFov = viewer.getHfovBounds ? viewer.getHfovBounds()[1] : 120;
        viewer.setHfov(maxFov, 1000); 
        viewer.setPitch(0, 1000);
        // Start rotation (negative is left)
        viewer.startAutoRotate(-5); 
    }
}

function onAutoPlayNext() {
    let nextIndex = (currentIndex + 1) % images.length;
    transitionToImage(nextIndex);
}

// --- CONTROLS ---

document.getElementById("prevBtn").onclick = () => {
    resetIdleTimer();
    let newIndex = (currentIndex - 1 + images.length) % images.length;
    transitionToImage(newIndex);
};

document.getElementById("nextBtn").onclick = () => {
    resetIdleTimer();
    let newIndex = (currentIndex + 1) % images.length;
    transitionToImage(newIndex);
};

// Custom Fullscreen (keeps sidebar visible)
const fsBtn = document.getElementById("fsBtn");
const appContainer = document.getElementById("app");

fsBtn.onclick = () => {
    resetIdleTimer();
    if (!document.fullscreenElement) {
        appContainer.requestFullscreen().catch(err => {
            console.log(`Error enabling fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
};

// --- START ---
// Initialize the gallery by fetching images from GitHub
initGallery();
