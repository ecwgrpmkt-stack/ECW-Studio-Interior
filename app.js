const images = [
    { src: "images/img1.jpg" }, { src: "images/img2.jpg" },
    { src: "images/img3.jpg" }, { src: "images/img4.jpg" },
    { src: "images/img5.jpg" }, { src: "images/img6.jpg" },
    { src: "images/img7.jpg" }, { src: "images/img8.jpg" },
    { src: "images/img9.jpg" }, { src: "images/img10.jpg" }
];

let currentIndex = 0;
let viewer = null;
let activeImageSrc = null; // Track current image to prevent race conditions

// TIMERS
let idleTimer = null;
let slideTimer = null;
const IDLE_DELAY = 3000;       // 3 seconds before showing hand/zooming out
const AUTO_PLAY_DELAY = 60000; // 60 seconds before auto-advancing

// --- MAIN VIEWER LOGIC ---

function loadViewer(index) {
    const imgData = images[index];
    activeImageSrc = imgData.src;

    // 1. Pre-load Image to analyze dimensions
    const tempImg = new Image();
    tempImg.src = imgData.src;
    
    tempImg.onload = function() {
        // Prevent loading if user switched image while this was processing
        if (tempImg.src.indexOf(activeImageSrc) === -1) return;

        // Calculate Aspect Ratio (Width / Height)
        const aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
        detectAndSetupScene(aspectRatio, imgData.src);
    };
}

function detectAndSetupScene(aspectRatio, imageSrc) {
    // Destroy existing viewer to free memory
    if (viewer) {
        viewer.destroy();
    }

    // Default Configuration
    let config = {
        type: "equirectangular",
        panorama: imageSrc,
        autoLoad: true,
        showControls: false,
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

    // Attach Idle Detection Events
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
        thumb.src = img.src;
        thumb.className = "thumb";
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

    if (viewer) {
        viewer.stopAutoRotate();
    }
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

// --- INITIALIZATION ---
buildThumbnails();
loadViewer(currentIndex);
