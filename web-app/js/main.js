let dataset = [];
let years = [];
let markersByYear = new Map(); // year → [circleMarker, ...]
let currentYearMarkers = [];
let activeMarker = null;
let currentYearIdx = 0;
let isPlaying = true;

/* Timer state */
let nextYearTimeout = null;
let cycleIntervalId = null;
let progressRaf = null;
let progressStart = null;
let progressElapsed = 0;

const YEAR_DURATION = 10000;

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
    currentYearMarkers.forEach(m => map.removeLayer(m));
    activeMarker = null;
    currentYearMarkers = markersByYear.get(year) || [];
    currentYearMarkers.forEach(m => {
        m.setStyle(MARKER_DEFAULT);
        m.addTo(map);
    });
}

/* ── Panel helpers ── */
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

/* ── Progress bar ── */
function startProgressFrom(elapsed) {
    if (progressRaf) cancelAnimationFrame(progressRaf);
    progressStart = performance.now() - elapsed;
    function tick(now) {
        const pct = Math.min((now - progressStart) / YEAR_DURATION * 100, 100);
        progressBar.style.width = pct + '%';
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

/* ── Controls ── */
btnPlay.addEventListener('click', () => setPlaying(!isPlaying));

document.getElementById('btn-prev-year').addEventListener('click', () => {
    currentYearIdx = (currentYearIdx - 1 + years.length) % years.length;
    progressElapsed = 0;
    showYearPanel(years[currentYearIdx]);
    if (isPlaying) startCycle();
});

document.getElementById('btn-next-year').addEventListener('click', () => {
    currentYearIdx = (currentYearIdx + 1) % years.length;
    progressElapsed = 0;
    showYearPanel(years[currentYearIdx]);
    if (isPlaying) startCycle();
});

document.getElementById('btn-back-year').addEventListener('click', () => {
    showYearPanel(years[currentYearIdx]);
});

/* ── Data loading ── */
fetch('web-app/assets/data.csv')
    .then(r => r.text())
    .then(text => {
        const [header, ...rows] = text.trim().split('\n');
        const keys = parseCSVRow(header);

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
            if (!markersByYear.has(d.year)) markersByYear.set(d.year, []);
            markersByYear.get(d.year).push(marker);
        });

        showYearPanel(years[0]);
        setPlaying(true);
    });
