function detectAndSetupScene(aspectRatio, imageSrc) {
    if (viewer) {
        viewer.destroy();
    }

    let config = {
        type: "equirectangular",
        panorama: imageSrc,
        autoLoad: true,
        showControls: false,
        yaw: 0,
        pitch: 0,
        autoRotate: 0
    };

    // LOGIC: Analyze Image Type
    
    // 1. Full 360 Sphere (Aspect Ratio ≈ 2.0)
    // Example: 6000x3000
    const isFullSphere = aspectRatio >= 1.9 && aspectRatio <= 2.1;

    if (isFullSphere) {
        // --- TYPE A: FULL 360 LOOP ---
        updateBadge("360");
        
        config.haov = 360; 
        config.vaov = 180;
        config.hfov = 100;
        config.minHfov = 50;
        config.maxHfov = 120;
    } else {
        // --- TYPE B: CYLINDRICAL / PARTIAL PANORAMA ---
        updateBadge("pano");

        // We assume a standard vertical field of view for phone cameras (approx 60 degrees)
        const assumedVerticalFOV = 60;
        
        // Calculate how many horizontal degrees this image actually covers
        // Formula: Width = Height * AspectRatio
        let calculatedHorizontalFOV = assumedVerticalFOV * aspectRatio;

        // Cap it at 360 if it's super wide
        if (calculatedHorizontalFOV > 360) {
            calculatedHorizontalFOV = 360;
        }

        config.haov = calculatedHorizontalFOV;  
        config.vaov = assumedVerticalFOV;       
        config.vOffset = 0;
        
        // --- CRITICAL FIX FOR SEAMS ---
        // If the image is LESS than 360 degrees (e.g. iPhone pano), 
        // we restrict the Yaw (rotation) so it stops at the edges.
        if (calculatedHorizontalFOV < 360) {
            const halfWidth = calculatedHorizontalFOV / 2;
            config.minYaw = -halfWidth;
            config.maxYaw = halfWidth;
            // Note: Pannellum automatically disables looping if minYaw/maxYaw are set
        }

        // Lock Vertical limits to prevent looking at black bars
        config.minPitch = -assumedVerticalFOV / 2;
        config.maxPitch = assumedVerticalFOV / 2;
        
        // Zoom settings
        config.hfov = assumedVerticalFOV; 
        config.minHfov = 30;
        config.maxHfov = assumedVerticalFOV; 
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
