// JAVASCRIPT CODE FOR ANIMATED MOVEMENT 
// IN THE MAP WITH TRAIL

/* Initialise the empty dataset object to 
   populate with content of input .csv file */
let dataset = [];

/* Interactive map */

const map = L.map('map', { zoomControl: false, attributionControl: true, zoomSnap: 0.5 })
    .setView([43.5, 10.0], 6.5);

L.control.zoom({ position: 'topright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

/* ------------------------- */
/* Parameters initialisation */

/* Constant for transition speed 
   (move from a point to the next) */

const MOVE_DURATION = 1600;
const SPEED_MIN_MS = 1000;
const SPEED_MAX_MS = 32000;

let currentMarker = null;
let currentPos = null;
let trailPoints = []; // Already visited city (increases at every slide)
let trailLine = null; // L.polyline layer to draw the dashed line
let animRaf = null;   // animation RequestAnimationFrame: ID of scheduled slide
let pendingDest = null;
let currentIndex = 0;
let isPlaying = true;
let intervalId = null;
let intervalMs = 2000;

const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnSlower = document.getElementById('btn-slower');
const btnFaster = document.getElementById('btn-faster');

/* ------------------------- */

// Creates ease-in-out curve, avoiding abrupt movements
function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; } 

// Update transition speed (called by buttons)
function updateSpeedButtons() {
    btnSlower.disabled = intervalMs >= SPEED_MAX_MS;
    btnFaster.disabled = intervalMs <= SPEED_MIN_MS;
}

// Create animated pulsing dot (animation defined in css)
function createPulseIcon() {
    return L.divIcon({
        className: '',
        html: `<div style="position:relative;width:20px;height:20px">
      <div class="pulse-ring" style="width:20px;height:20px;top:0;left:0"></div>
      <div style="width:12px;height:12px;background:#4F90CC;border-radius:50%;position:absolute;top:4px;left:4px;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.25)"></div>
    </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

// Create a trail of the visited city
function updateTrail() {
    if (trailLine) map.removeLayer(trailLine); // Initialise when repeated
    if (trailPoints.length > 1) {
        trailLine = L.polyline(trailPoints, {
            color: '#4F90CC', weight: 4, opacity: 0.50, dashArray: '3 7'
        }).addTo(map);
        trailLine.bringToBack();
    }
}

// Move the marker with a fluid animation
function animateMarkerTo(toLat, toLng) {

    if (animRaf) {
        cancelAnimationFrame(animRaf);
        // Animation interrupted if visitors clicks on control buttons — 
        // flush pending destination into trail so the line stays continuous
        if (pendingDest) {
            trailPoints.push([pendingDest.lat, pendingDest.lng]);
            updateTrail();
        }
    }

    pendingDest = { lat: toLat, lng: toLng };
    const fromLat = currentPos ? currentPos.lat : toLat;
    const fromLng = currentPos ? currentPos.lng : toLng;
    const t0 = performance.now();

    // For first slide
    if (!currentMarker) {
        currentMarker = L.marker([fromLat, fromLng], { icon: createPulseIcon() }).addTo(map);
    }

    // Core function to move the marker and update the trail
    function step(now) {
        const raw = Math.min((now - t0) / MOVE_DURATION, 1);
        const e = ease(raw);
        const lat = fromLat + (toLat - fromLat) * e;
        const lng = fromLng + (toLng - fromLng) * e;
        currentMarker.setLatLng([lat, lng]);
        currentPos = { lat, lng };
        if (raw < 1) {
            animRaf = requestAnimationFrame(step); // Browser native
        } else {
            currentPos = { lat: toLat, lng: toLng };
            trailPoints.push([toLat, toLng]);
            pendingDest = null;
            updateTrail();
        }
    }

    // Call "step" before next repaint of the window
    animRaf = requestAnimationFrame(step);
}

/* 
  Main function: calls a row in the dataset
  and calls the function "animateMarkerTo"
*/
function showRecord(idx, skipAnimation) {
    const d = dataset[idx];
    document.getElementById('city-name').textContent = d.city;
    document.getElementById('city-year').textContent = d.year;
    document.getElementById('stat-photos').textContent = d.total.toLocaleString('it-IT');


    if (skipAnimation) { // For first slide and loop reset
        currentPos = { lat: d.lat, lng: d.lng };
        trailPoints = [[d.lat, d.lng]];
        if (currentMarker) map.removeLayer(currentMarker);
        currentMarker = L.marker([d.lat, d.lng], { icon: createPulseIcon() }).addTo(map);
        updateTrail();
    } else {            // In all other cases
        animateMarkerTo(d.lat, d.lng);
    }
}

// Re-initialise the map - for when the last city is reached
function resetTrail(idx) {
    if (trailLine) { map.removeLayer(trailLine); trailLine = null; }
    trailPoints = [];
    pendingDest = null;
    if (animRaf) { cancelAnimationFrame(animRaf); animRaf = null; }
    const d = dataset[idx];
    currentPos = { lat: d.lat, lng: d.lng };
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([d.lat, d.lng], { icon: createPulseIcon() }).addTo(map);
}

// Updates the UI and the logic of the play system
function startInterval() {
    clearInterval(intervalId);
    intervalId = setInterval(() => {
        if (currentIndex >= dataset.length - 1) {
            setPlaying(false);
            return;
        }
        currentIndex++;
        showRecord(currentIndex, false);
    }, intervalMs);
}

// Updates the UI and the logic of the play system
function setPlaying(val) {
    isPlaying = val;
    if (isPlaying) {
        btnPlay.innerHTML = '<i class="bi bi-pause-fill"></i>';
    } else if (currentIndex >= dataset.length - 1) {
        btnPlay.innerHTML = '<i class="bi bi-repeat"></i>';
    } else {
        btnPlay.innerHTML = '<i class="bi bi-play-fill"></i>';
    }
    if (isPlaying) {
        // If we're at the end, reset trail and restart from the beginning
        if (currentIndex >= dataset.length - 1) {
            currentIndex = 0;
            resetTrail(0);
            showRecord(0, true);
        }
        startInterval();
    } else {
        clearInterval(intervalId);
    }
}

/* — Controlli — */
btnPlay.addEventListener('click', () => setPlaying(!isPlaying));

btnPrev.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + dataset.length) % dataset.length;
    showRecord(currentIndex, false);
    if (isPlaying) startInterval();
});

btnNext.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % dataset.length;
    showRecord(currentIndex, false);
    if (isPlaying) startInterval();
});

btnSlower.addEventListener('click', () => {
    intervalMs = Math.min(intervalMs * 2, SPEED_MAX_MS);
    updateSpeedButtons();
    if (isPlaying) startInterval();
});

btnFaster.addEventListener('click', () => {
    intervalMs = Math.max(intervalMs / 2, SPEED_MIN_MS);
    updateSpeedButtons();
    if (isPlaying) startInterval();
});

/* As soon as the web-app is loaded
   Upload the csv file and load its 
   data of "dataset" (l. 4)*/

fetch('web-app/assets/data.csv')
    .then(r => r.text())
    .then(text => {
        const [header, ...rows] = text.trim().split('\n');
        const keys = header.split(',');
        dataset = rows.map(row => {
            const vals = row.split(',');
            const obj = {};
            keys.forEach((k, i) => {
                const v = vals[i].trim();
                obj[k.trim()] = (k === 'total' || k === 'year') ? parseInt(v, 10)
                              : (k === 'lat'    || k === 'lng')   ? parseFloat(v)
                              : v;
            });
            return obj;
        });
        updateSpeedButtons();
        showRecord(0, true);
        startInterval();
    });
