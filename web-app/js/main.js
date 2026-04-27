let dataset = [];
let years = [];
let markersByYear = new Map();      // year → [circleMarker, ...]
let currentYearMarkers = [];
let activeMarker = null;
let currentYearIdx = 0;
let isPlaying = true;

/* Timer state */
let nextYearTimeout = null;
let cycleIntervalId = null;
let progressRaf = null;             // id of active requestAnimationFrame (from browser: run before next screen repaint)
let progressStart = null;           // timestamp of when the animation began
let progressElapsed = 0;            // seconds passed when user clicks on pause

const YEAR_DURATION = 4000;

/* Map */
const map = L.map('map', { zoomControl: false, attributionControl: true, zoomSnap: 0.5 })
    .setView([43.8, 12], 7);

L.control.zoom({ position: 'topright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

/* DOM refs */
const btnPlay     = document.getElementById('btn-play');
const progressBar = document.getElementById('progress-bar');

/* ── Marker styles ── */
const MARKER_DEFAULT = { radius: 8, fillColor: '#8fb3cc', color: '#fff', weight: 1.5, fillOpacity: 0.85 };
const MARKER_ACTIVE  = { radius: 13, fillColor: '#4F90CC', color: '#fff', weight: 2, fillOpacity: 1 };

/* ── CSV parser (handles quoted fields with commas) ── */
function parseCSVRow(row) {
    const vals = [];
    let cur = '';
    let inQuote = false;
    for (const ch of row) {
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; }
        else { cur += ch; }
    }
    vals.push(cur.trim());
    return vals;
}

/* ── Marker layer management ── */
function setYearMarkers(year) {
    currentYearMarkers.forEach(m => map.removeLayer(m));  // Remove old markers
    activeMarker = null;                                  // Remove current visualised city
    currentYearMarkers = markersByYear.get(year) || [];
    currentYearMarkers.forEach(m => {
        m.setStyle(MARKER_DEFAULT);
        m.addTo(map);
    });
}

/* ── UI editing functions for panels ── */
function showYearPanel(yearData) {
    setYearMarkers(yearData.year);
    document.getElementById('panel-city').hidden = true;
    document.getElementById('panel-year').hidden = false;
    document.getElementById('year-label').textContent = yearData.year;
    document.getElementById('stat-cities').textContent = yearData.cities.length.toLocaleString('it-IT');
    document.getElementById('stat-year-photos').textContent = yearData.totalPhotos.toLocaleString('it-IT');
}

function showCityPanel(marker, record) {
    if (activeMarker) activeMarker.setStyle(MARKER_DEFAULT);
    activeMarker = marker;
    marker.setStyle(MARKER_ACTIVE);
    document.getElementById('panel-year').hidden = true;
    document.getElementById('panel-city').hidden = false;
    document.getElementById('city-name-display').textContent = record.city;
    document.getElementById('city-year-display').textContent = record.year;
    document.getElementById('stat-photos').textContent = record.total.toLocaleString('it-IT');
}

/* ── UI editing functions for controls ── */
function setPlaying(val) {
    isPlaying = val; 
    if (isPlaying) {
        btnPlay.innerHTML = '<i class="bi bi-pause-fill"></i>';
        startCycle();
    } else {
        btnPlay.innerHTML = '<i class="bi bi-play-fill"></i>';
        clearTimeout(nextYearTimeout);
        clearInterval(cycleIntervalId);
        stopProgress();
    }
}

/* ── Progress bar ── */
function startProgressFrom(elapsed) {
    if (progressRaf) cancelAnimationFrame(progressRaf); /* To cancel animation when clicking on pause */
    progressStart = performance.now() - elapsed;
    function tick(now) {
        const pct = Math.min((now - progressStart) / YEAR_DURATION * 100, 100);
        progressBar.style.width = pct + '%';
        /* Only if percentage lower than 100% */
        if (pct < 100) progressRaf = requestAnimationFrame(tick);
    }
    progressRaf = requestAnimationFrame(tick);
}

function stopProgress() {
    if (progressRaf) { cancelAnimationFrame(progressRaf); progressRaf = null; }
    if (progressStart !== null) progressElapsed = performance.now() - progressStart;
}

/* ── Year cycling ── */
function advanceYear() {
    currentYearIdx = (currentYearIdx + 1) % years.length;
    showYearPanel(years[currentYearIdx]);
    progressElapsed = 0;
    startProgressFrom(0);
}

function startCycle() {
    clearTimeout(nextYearTimeout);
    clearInterval(cycleIntervalId);
    const remaining = YEAR_DURATION - progressElapsed;
    nextYearTimeout = setTimeout(() => {
        advanceYear();
        cycleIntervalId = setInterval(advanceYear, YEAR_DURATION);
    }, remaining);
    startProgressFrom(progressElapsed);
}

/* ── Controls ── */
btnPlay.addEventListener('click', () => setPlaying(!isPlaying));                // Play / pause

document.getElementById('btn-prev-year').addEventListener('click', () => {      // Show previous year
    currentYearIdx = (currentYearIdx - 1 + years.length) % years.length;
    progressElapsed = 0;
    showYearPanel(years[currentYearIdx]);
    if (isPlaying) startCycle();
});

document.getElementById('btn-next-year').addEventListener('click', () => {      // Show next year
    currentYearIdx = (currentYearIdx + 1) % years.length;
    progressElapsed = 0;
    showYearPanel(years[currentYearIdx]);
    if (isPlaying) startCycle();
});

document.getElementById('btn-back-year').addEventListener('click', () => {      // Close city panel
    showYearPanel(years[currentYearIdx]);
});

/* ── Data loading ── */
fetch('web-app/assets/data.csv')
    .then(r => r.text())
    .then(text => {
        const [header, ...rows] = text.trim().split('\n');
        const keys = parseCSVRow(header);

        /* Populate `dataset` */
        dataset = rows.map(row => {
            const vals = parseCSVRow(row);
            const obj = {};
            keys.forEach((k, i) => {
                const v = (vals[i] || '').trim();
                obj[k] = (k === 'total' || k === 'year') ? parseInt(v, 10)
                       : (k === 'lat'   || k === 'lng')  ? parseFloat(v)
                       : v;
            });
            return obj;
        }).filter(d =>
            /* Filter out missing year or geocoordinates */
            Number.isInteger(d.year) &&
            !isNaN(d.lat) && d.lat !== 0 &&
            !isNaN(d.lng) && d.lng !== 0
        );

        /* Group by year */
        const yearMap = new Map();
        dataset.forEach(d => {
            if (!yearMap.has(d.year)) yearMap.set(d.year, { year: d.year, cities: [], totalPhotos: 0 });
            const y = yearMap.get(d.year);
            y.cities.push(d);
            y.totalPhotos += d.total;
        });
        years = [...yearMap.values()].sort((a, b) => a.year - b.year);

        /* Create all markers (not yet added to map) */
        dataset.forEach(d => {
            const marker = L.circleMarker([d.lat, d.lng], { ...MARKER_DEFAULT, opacity: 1 });
            marker.on('click', () => showCityPanel(marker, d));
            /* Ancillary Map: each year contains array of markers */
            if (!markersByYear.has(d.year)) markersByYear.set(d.year, []); 
            markersByYear.get(d.year).push(marker);
        });

        showYearPanel(years[0]);
        setPlaying(true);
    });


/*

    The web app flows as follows: 
    
    WHEN WEB-APP IS LOADED

    1) Fetch data from the csv and populate main `dataset`, then
       group by year and populate Map object (markersByYear): it
       associates for each year a list of L.circleMarker objects

    2) call `showYearPanel()` for the first record of the Map

        a) `setYearMarkers()` is called to plot the markers for the
            year on the map
        b)  The left panel is updated

    3) call `setPlaying(true)`

        a) updates UI of the central control
        b) call `startCycle`()
            i) create and animate progress bar
        c) after a timeout, update with `advanceYear()`

    WHEN CLICKING ON MARKER

    1) Set the current marker as active with `showCityPanel()``

        a) Updates the panel with info of the city

    CONTROLS

    1) "Play / Pause"

        a) call `setPlaying()`, controlling play / pause of timer and
           progress bar with global `isPlaying` boolean
           i) use `startProgressFrom`, storing elapsed time in current
              cycle in `progressElapsed`, and `stopProgress`

    2) "Next" / "Previous year": begin a new cicle, re-initialising
       ancillary values (timeOut, interval, progressElapsed) for
       automatic transition between years. Calls same function of when
       app is loaded, but with different indices

    3) "Close city panel" close the city panel and remove active marker styling

*/