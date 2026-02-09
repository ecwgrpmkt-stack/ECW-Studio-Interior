const images = [
    { src: "images/img1.jpg" }, { src: "images/img2.jpg" },
    { src: "images/img3.jpg" }, { src: "images/img4.jpg" },
    { src: "images/img5.jpg" }, { src: "images/img6.jpg" },
    { src: "images/img7.jpg" }, { src: "images/img8.jpg" },
    { src: "images/img9.jpg" }, { src: "images/img10.jpg" }
];

let currentIndex = 0;
let viewer = null;

function loadViewer(i) {
    // Properly destroy previous instance to free up resources
    if (viewer) {
        viewer.destroy();
    }

    viewer = pannellum.viewer('viewer', {
        type: "equirectangular",
        panorama: images[i].src,
        autoRotate: 2,
        autoRotateInactivityDelay: 3000,
        mouseZoom: true,
        autoLoad: true // Prevents having to click "Load" manually for every image
    });

    updateThumbs();
}

function buildThumbnails() {
    const panel = document.getElementById("thumbPanel");
    panel.innerHTML = "";

    images.forEach((img, i) => {
        const thumb = document.createElement("img");
        thumb.src = img.src;
        thumb.className = "thumb";
        thumb.onclick = () => {
            currentIndex = i;
            loadViewer(i);
        };
        panel.appendChild(thumb);
    });
}

function updateThumbs() {
    document.querySelectorAll(".thumb").forEach((t, i) => {
        t.classList.toggle("active", i === currentIndex);
    });
}

document.getElementById("prevBtn").onclick = () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    loadViewer(currentIndex);
};

document.getElementById("nextBtn").onclick = () => {
    currentIndex = (currentIndex + 1) % images.length;
    loadViewer(currentIndex);
};

// Initial Setup
buildThumbnails();
loadViewer(currentIndex);
