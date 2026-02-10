// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";
const IMAGE_FOLDER_PATH = "images";
const BRANCH_FALLBACK = "main"; // Use 'master' if your repo uses master

// GLOBALS
let images = []; 
let currentIndex = 0;
let viewer = null;
let activeImageSrc = null;

// TIMERS
let idleTimer = null;
let slideTimer = null;
const IDLE_DELAY = 3000;       
const AUTO_PLAY_DELAY = 60000; 

// DRAWING GLOBALS
let isDrawingMode = false;
let isDrawing = false;
let drawCtx = null;
let canvas = null;
let currentBrushSize = 5;
let currentColor = "#ff0000";
let isEraser = false;

// --- 1. ROBUST INITIALIZATION ---

async function initGallery() {
    initDrawingTools();

    console.log("Attempting to load images...");

    try {
        // METHOD A: GitHub API (The best way, but has rate limits)
        const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGE_FOLDER_PATH}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`GitHub API Error: ${response.status}`);
        }

        const data = await response.json();

        images = data
            .filter(file => file.name.match(/\.(jpg|jpeg|png)$/i))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}))
            .map(file => {
                // Use the API's provided download_url directly (most reliable)
                const rawUrl = file.download_url;
                // Create optimized proxy URL
                const optimizedSrc = `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&w=8000&we&q=85&output=webp`;
                
                return { src: optimizedSrc, originalPath: rawUrl };
            });

        console.log(`API Success: Loaded ${images.length} images.`);
        finishInit();

    } catch (error) {
        console.warn("API failed (likely rate limit). Switching to FALLBACK mode.", error);
        loadFallbackImages();
    }
}

// METHOD B: Manual Fallback (If API fails)
function loadFallbackImages() {
    // Manually construct URLs for img1.jpg to img15.jpg
    const fallbackList = [];
    const maxGuess = 15; // Try to load first 15 images

    for (let i = 1; i <= maxGuess; i++) {
        // Construct a raw GitHub User Content URL
        // Try 'main' branch first. If your repo is 'master', change the const at top.
        const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH_FALLBACK}/${IMAGE_FOLDER_PATH}/img${i}.jpg`;
        
        const optimizedSrc = `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&w=8000&we&q=85&output=webp`;
        
        fallbackList.push({ src: optimizedSrc, originalPath: rawUrl });
    }

    images = fallbackList;
    console.log(`Fallback Mode: Attempting to load ${images.length} predicted images.`);
    finishInit();
}

function finishInit() {
    if (images.length === 0) {
        alert("Critical Error: No images could be loaded. Check console for details.");
        return;
    }
    buildThumbnails();
    loadViewer(currentIndex);
}

// --- 2. DRAWING LOGIC ---

function initDrawingTools() {
    canvas = document.getElementById("drawingCanvas");
    drawCtx = canvas.getContext("2d");

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const pencilBtn = document.getElementById("pencilBtn");
    const brushSizeBtn = document.getElementById("brushSizeBtn");
    const colorPaletteBtn = document.getElementById("colorPaletteBtn");
    const eraserBtn = document.getElementById("eraserBtn");
    const clearBtn = document.getElementById("clearBtn");
    const sizeSlider = document.getElementById("sizeSlider");

    pencilBtn.onclick = () => { isDrawingMode = !isDrawingMode; toggleDrawingState(); };
    
    brushSizeBtn.onclick = () => togglePopup("brushPopup");
    sizeSlider.oninput = (e) => { currentBrushSize = e.target.value; };

    colorPaletteBtn.onclick = () => {
        togglePopup("colorPopup");
        if (isEraser) { isEraser = false; eraserBtn.classList.remove("active"); }
    };

    document.querySelectorAll(".color-swatch").forEach(swatch => {
        swatch.onclick = () => {
            currentColor = swatch.getAttribute("data-color");
            document.getElementById("colorPopup").style.display = "none";
        };
    });

    eraserBtn.onclick = () => {
        if (!isDrawingMode) return;
        isEraser = !isEraser;
        eraserBtn.classList.toggle("active", isEraser);
    };

    clearBtn.onclick = () => {
        drawCtx.clearRect(0, 0, canvas.width, canvas.height);
        if (isDrawingMode) { isDrawingMode = false; toggleDrawingState(); }
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseout', stopDraw);
    
    canvas.addEventListener('touchstart', (e) => { if(e.cancelable) e.preventDefault(); startDraw(e.touches[0]); }, {passive: false});
    canvas.addEventListener('touchmove', (e) => { if(e.cancelable) e.preventDefault(); draw(e.touches[0]); }, {passive: false});
    canvas.addEventListener('touchend', stopDraw);
}

function resizeCanvas() {
    if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
}

function togglePopup(id) {
    const popups = document.querySelectorAll(".tool-popup");
    popups.forEach(p => {
        p.style.display = (p.id === id && p.style.display !== "flex") ? "flex" : "none";
    });
}

function toggleDrawingState() {
    const pencilBtn = document.getElementById("pencilBtn");
    const lockIcon = document.getElementById("lockIndicatorTool");
    const eraserBtn = document.getElementById("eraserBtn");

    if (isDrawingMode) {
        pencilBtn.classList.add("active");
        lockIcon.style.display = "block";
        canvas.style.pointerEvents = "auto";
        resetIdleTimer();
        if(viewer) viewer.stopAutoRotate();
    } else {
        pencilBtn.classList.remove("active");
        eraserBtn.classList.remove("active");
        lockIcon.style.display = "none";
        document.querySelectorAll(".tool-popup").forEach(p => p.style.display = "none");
        canvas.style.pointerEvents = "none";
        isEraser = false;
        startIdleCountdown();
    }
}

function startDraw(e) {
    if (!isDrawingMode) return;
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawCtx.beginPath();
    drawCtx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing || !isDrawingMode) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawCtx.lineWidth = currentBrushSize;
    drawCtx.lineCap = "round";
    
    if (isEraser) {
        drawCtx.globalCompositeOperation = "destination-out";
        drawCtx.strokeStyle = "rgba(0,0,0,1)";
    } else {
        drawCtx.globalCompositeOperation = "source-over";
        drawCtx.strokeStyle = currentColor;
    }
    drawCtx.lineTo(x, y);
    drawCtx.stroke();
}

function stopDraw() { isDrawing = false; drawCtx.closePath(); }

// --- 3. VIEWER LOGIC ---

function loadViewer(index) {
    if (!images[index]) return;
    const imgData = images[index];
    activeImageSrc = imgData.src;

    // Use a temporary image to check if the file actually exists
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
        console.error("Image failed to load (404 or Network Error):", imgData.src);
        // If image fails, try the next one automatically? 
        // Or just let the user see a blank screen (safer to avoid loops)
    };
}

function preloadNextImage(currentIndex) {
    const nextIndex = (currentIndex + 1) % images.length;
    if (images[nextIndex]) {
        const preloadImg = new Image();
        preloadImg.crossOrigin = "Anonymous";
        preloadImg.src = images[nextIndex].src;
    }
}

function detectAndSetupScene(aspectRatio, imageSrc) {
    if (viewer) viewer.destroy();

    let config = {
        type: "equirectangular",
        panorama: imageSrc,
        autoLoad: true,
        showControls: false,
        crossOrigin: "anonymous", 
        yaw: 0, pitch: 0, autoRotate: 0 
    };

    const isFullSphere = aspectRatio >= 1.9 && aspectRatio <= 2.1;

    if (isFullSphere) {
        updateBadge("360");
        config.haov = 360; config.vaov = 180;
        config.hfov = 100; config.minHfov = 50; config.maxHfov = 120;
    } else {
        updateBadge("pano");
        const assumedVerticalFOV = 60; 
        let calculatedHorizontalFOV = assumedVerticalFOV * aspectRatio;
        if (calculatedHorizontalFOV > 360) calculatedHorizontalFOV = 360;

        config.haov = calculatedHorizontalFOV; config.vaov = assumedVerticalFOV; config.vOffset = 0;           
        if (calculatedHorizontalFOV < 360) {
            const halfWidth = calculatedHorizontalFOV / 2;
            config.minYaw = -halfWidth; config.maxYaw = halfWidth;
        }
        config.minPitch = -assumedVerticalFOV / 2; config.maxPitch = assumedVerticalFOV / 2;
        config.hfov = assumedVerticalFOV; config.minHfov = 30; config.maxHfov = assumedVerticalFOV + 20; 
    }

    viewer = pannellum.viewer('viewer', config);

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
        badge.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21.5 12a9.5 9.5 0 1 1-9.5-9.5"/><path d="M12 7v5l3 3"/><circle cx="12" cy="12" r="2"/></svg><span>360° View</span>`;
    } else {
        badge.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="8" width="20" height="8" rx="2"></rect><line x1="2" y1="12" x2="22" y2="12" stroke-dasharray="2 2"></line></svg><span>Panorama View</span>`;
    }
}

function transitionToImage(index) {
    if (isDrawingMode) {
        drawCtx.clearRect(0, 0, canvas.width, canvas.height);
        isDrawingMode = false;
        toggleDrawingState();
    }
    const overlay = document.getElementById('fadeOverlay');
    overlay.classList.add('active');
    setTimeout(() => {
        currentIndex = index;
        loadViewer(currentIndex);
        setTimeout(() => { overlay.classList.remove('active'); }, 500); 
    }, 500);
}

function buildThumbnails() {
    const panel = document.getElementById("thumbPanel");
    panel.innerHTML = "";
    images.forEach((img, i) => {
        const thumb = document.createElement("img");
        // Use optimized URL for thumbnail
        thumb.src = `https://wsrv.nl/?url=${encodeURIComponent(img.originalPath)}&w=200&q=70&output=webp`;
        thumb.className = "thumb";
        thumb.crossOrigin = "Anonymous"; 
        thumb.onerror = () => { thumb.style.display = "none"; };
        thumb.onclick = () => { resetIdleTimer(); transitionToImage(i); };
        panel.appendChild(thumb);
    });
}

function updateThumbs() {
    document.querySelectorAll(".thumb").forEach((t, i) => {
        t.classList.toggle("active", i === currentIndex);
        if(i === currentIndex) t.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

function startIdleCountdown() {
    clearTimeout(idleTimer); clearTimeout(slideTimer);
    if (isDrawingMode) return;
    idleTimer = setTimeout(onIdleStart, IDLE_DELAY);
    slideTimer = setTimeout(onAutoPlayNext, AUTO_PLAY_DELAY);
}

function resetIdleTimer() {
    clearTimeout(idleTimer); clearTimeout(slideTimer);
    document.getElementById('idleIndicator').classList.remove('visible');
    if (viewer) viewer.stopAutoRotate();
}

function onIdleStart() {
    if (isDrawingMode) return;
    document.getElementById('idleIndicator').classList.add('visible');
    if (viewer) {
        const maxFov = viewer.getHfovBounds ? viewer.getHfovBounds()[1] : 120;
        viewer.setHfov(maxFov, 1000); 
        viewer.setPitch(0, 1000);
        viewer.startAutoRotate(-5); 
    }
}

function onAutoPlayNext() {
    if (isDrawingMode) return;
    let nextIndex = (currentIndex + 1) % images.length;
    transitionToImage(nextIndex);
}

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
const fsBtn = document.getElementById("fsBtn");
fsBtn.onclick = () => {
    resetIdleTimer();
    if (!document.fullscreenElement) {
        document.getElementById("app").requestFullscreen().catch(console.log);
    } else {
        document.exitFullscreen();
    }
};

initGallery();
