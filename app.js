const images = [
    { src: "images/img1.jpg" }, { src: "images/img2.jpg" },
    { src: "images/img3.jpg" }, { src: "images/img4.jpg" },
    { src: "images/img5.jpg" }, { src: "images/img6.jpg" },
    { src: "images/img7.jpg" }, { src: "images/img8.jpg" },
    { src: "images/img9.jpg" }, { src: "images/img10.jpg" }
];

let currentIndex = 0;
let viewer = null;
let activeImageSrc = null;

// TIMERS
let idleTimer = null;
let slideTimer = null;
const IDLE_DELAY = 3000;       
const AUTO_PLAY_DELAY = 60000; 

// --- MAIN VIEWER LOGIC ---

function loadViewer(index) {
    const imgData = images[index];
    activeImageSrc = imgData.src;

    // 1. Pre-load Image to detect Aspect Ratio
    const tempImg = new Image();
    tempImg.src = imgData.src;
    
    tempImg.onload = function() {
        if (tempImg.src.indexOf(activeImageSrc) === -1) return;
        
        // Calculate Aspect Ratio (Width / Height)
        const aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
        detectAndSetupScene(aspectRatio, imgData.src);
    };
}

function detectAndSetupScene(aspectRatio, imageSrc) {
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

    // LOGIC: Distinguish between Spherical 360 vs Cylindrical Panorama
    
    // Standard 360 Sphere is 2:1 (2.0).
    const isFullSphere = aspectRatio >= 1.9 && aspectRatio <= 2.1;

    if (isFullSphere) {
        // --- TYPE A: FULL 360 SPHERE ---
        updateBadge("360");
        
        config.haov = 360; // Full Horizontal
        config.vaov = 180; // Full Vertical
        config.hfov = 100;
        config.minHfov = 50;
        config.maxHfov = 120;
    } else {
        // --- TYPE B: CYLINDRICAL PANORAMA ---
        // We want 360° Horizontal rotation, but limited Vertical.
        updateBadge("pano");

        // Calculate the Vertical Angle of View (VAOV) needed to wrap 360 horizontally without distortion.
        // Formula: 360 degrees width / Aspect Ratio = Vertical degrees
        // Example: 6000x1000px (Ratio 6). 360 / 6 = 60 degrees high.
        const calculatedVAOV = 360 / aspectRatio;

        config.haov = 360;            // Force Full 360 Horizontal Loop
        config.vaov = calculatedVAOV; // Limit Vertical based on image height
        config.vOffset = 0;           // Keep centered
        
        // Lock Vertical limits so user can't look at black bars
        config.minPitch = -calculatedVAOV / 2;
        config.maxPitch = calculatedVAOV / 2;
        
        // Set Zoom: Start fully zoomed out to fit height, allow zooming in
        config.hfov = calculatedVAOV; 
        config.minHfov = 30;          // Allow zooming in for details
        config.maxHfov = calculatedVAOV; // Don't zoom out past the image edges
    }

    // Initialize Viewer
    viewer = pannellum.viewer('viewer', config);

    // Attach Events
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
        // Panorama Icon (Cylinder / Strip style)
        badge.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <path d="M2 12h20" stroke-dasharray="2 2"/>
            </svg>
            <span>Panorama View</span>
        `;
    }
}

// --- TRANSITION EFFECT ---
function transitionToImage(index) {
    const overlay = document.getElementById('fadeOverlay');
    overlay.classList.add('active');

    setTimeout(() => {
        currentIndex = index;
        loadViewer(currentIndex);

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
    idleTimer = setTimeout(onIdleStart, IDLE_DELAY);
    slideTimer = setTimeout(onAutoPlayNext, AUTO_PLAY_DELAY);
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    clearTimeout(slideTimer);
    document.getElementById('idleIndicator').classList.remove('visible');
    if (viewer) viewer.stopAutoRotate();
}

function onIdleStart() {
    document.getElementById('idleIndicator').classList.add('visible');
    if (viewer) {
        // Get the safe max zoom out level for the current image type
        const maxSafeFov = viewer.getHfovBounds ? viewer.getHfovBounds()[1] : 100;
        
        viewer.setHfov(maxSafeFov, 1000); 
        viewer.setPitch(0, 1000);
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

// Fullscreen Logic
const fsBtn = document.getElementById("fsBtn");
const appContainer = document.getElementById("app");
fsBtn.onclick = () => {
    resetIdleTimer();
    if (!document.fullscreenElement) {
        appContainer.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
};

// --- INITIALIZATION ---
buildThumbnails();
loadViewer(currentIndex);
