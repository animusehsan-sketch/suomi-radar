/**
 * Suomi Radar - Core Logic
 * High-performance flight tracking with smooth interpolation
 */

// Configuration
const CONFIG = {
    API_URL: 'https://api.airplanes.live/v2/point/64.0/26.0/250',
    REFRESH_INTERVAL: 10000, // 10 seconds for API fetch
    SMOOTH_INTERVAL: 1000,   // 1 second for interpolation
    INITIAL_VIEW: [64.0, 26.0],
    INITIAL_ZOOM: 5
};

// App State
const state = {
    map: null,
    markers: {},
    flights: [],
    searchQuery: '',
    sidebarHidden: false
};

// DOM Elements
const elements = {
    flightCount: document.getElementById('flight-count'),
    visibleCount: document.getElementById('visible-count'),
    lastUpdated: document.getElementById('last-updated'),
    flightList: document.getElementById('flight-list'),
    searchInput: document.getElementById('flight-search'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    recenterBtn: document.getElementById('recenter-btn')
};

// Plane SVG Template
const planeSVG = (color = 'var(--accent)') => `
<svg class="plane-marker" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 11.5L14 11.5L10 3L8.5 3L10.5 11.5L4 11.5L2.5 9.5L1 9.5L2.5 12.5L1 15.5L2.5 15.5L4 13.5L10.5 13.5L8.5 22L10 22L14 13.5L21 13.5C22.1 13.5 23 12.6 23 11.5C23 10.4 22.1 9.5 21 9.5L21 11.5Z" fill="${color}"/>
</svg>`;

/**
 * Initialize the Application
 */
function init() {
    // Initialize Leaflet Map
    state.map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView(CONFIG.INITIAL_VIEW, CONFIG.INITIAL_ZOOM);

    // Add Zoom Control to Top Right
    L.control.zoom({ position: 'topright' }).addTo(state.map);

    // Dark Mode Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(state.map);

    // Event Listeners
    elements.searchInput.addEventListener('input', handleSearch);
    elements.sidebarToggle.addEventListener('click', toggleSidebar);
    elements.recenterBtn.addEventListener('click', recenterMap);

    // Initial Fetch
    fetchFlights();

    // Set Timers
    setInterval(fetchFlights, CONFIG.REFRESH_INTERVAL);
    setInterval(smoothUpdate, CONFIG.SMOOTH_INTERVAL);
}

/**
 * Fetch Data from Airplanes.live
 */
async function fetchFlights() {
    try {
        const response = await fetch(CONFIG.API_URL);
        if (!response.ok) throw new Error('API Unavailable');
        
        const data = await response.json();
        const rawFlights = data.ac || [];
        
        // Transform API data to internal format
        state.flights = rawFlights
            .map(f => ({
                id: f.hex,
                callsign: (f.flight || '???').trim(),
                reg: f.r || 'N/A',
                lat: f.lat,
                lng: f.lon,
                alt: f.alt_baro || 0,
                speed: f.gs || 0,
                heading: f.track || 0,
                type: f.t || 'Unknown'
            }))
            .filter(f => f.lat !== undefined && f.lng !== undefined);

        updateUI();
        renderMarkers();
        
        elements.lastUpdated.textContent = new Date().toLocaleTimeString('en-GB');
    } catch (error) {
        console.error('Radar Error:', error);
        if (state.flights.length === 0) {
            elements.flightList.innerHTML = '<li class="flight-placeholder">Signal Lost. Reconnecting...</li>';
        }
    }
}

/**
 * Smoothly Interpolate Plane Positions (Dead Reckoning)
 */
function smoothUpdate() {
    if (state.flights.length === 0) return;

    state.flights.forEach(f => {
        if (f.speed > 0) {
            // 1 knot ≈ 0.000514 km/s. 1 degree ≈ 111km.
            // 1 knot ≈ 4.63e-6 degrees/second
            const speedFactor = 0.00000463; 
            const rad = (f.heading - 90) * (Math.PI / 180);
            
            f.lat -= Math.sin(rad) * (f.speed * speedFactor);
            f.lng += Math.cos(rad) * (f.speed * speedFactor);
        }
    });

    renderMarkers();
}

/**
 * Render Plane Markers on Map
 */
function renderMarkers() {
    const currentIds = new Set();
    const filteredFlights = getFilteredFlights();

    filteredFlights.forEach(f => {
        currentIds.add(f.id);
        const rotation = f.heading - 90;
        
        const iconHtml = `
            <div class="plane-icon-wrapper" style="transform: rotate(${rotation}deg)">
                ${planeSVG()}
            </div>
        `;

        const icon = L.divIcon({
            html: iconHtml,
            className: 'custom-plane-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const popupContent = `
            <div class="popup-container">
                <div class="popup-header">
                    <span class="popup-callsign">${f.callsign}</span>
                </div>
                <div class="popup-grid">
                    <div class="popup-item">
                        <span class="popup-label">Registration</span>
                        <span class="popup-value">${f.reg}</span>
                    </div>
                    <div class="popup-item">
                        <span class="popup-label">Altitude</span>
                        <span class="popup-value">${formatAlt(f.alt)}</span>
                    </div>
                    <div class="popup-item">
                        <span class="popup-label">Ground Speed</span>
                        <span class="popup-value">${Math.round(f.speed)} kts</span>
                    </div>
                    <div class="popup-item">
                        <span class="popup-label">Heading</span>
                        <span class="popup-value">${Math.round(f.heading)}°</span>
                    </div>
                </div>
            </div>
        `;

        if (state.markers[f.id]) {
            state.markers[f.id].setLatLng([f.lat, f.lng]);
            state.markers[f.id].setIcon(icon);
            // Only update popup if not open to avoid flicker
            if (!state.markers[f.id].isPopupOpen()) {
                state.markers[f.id].setPopupContent(popupContent);
            }
        } else {
            const marker = L.marker([f.lat, f.lng], { icon })
                .bindPopup(popupContent, { offset: [0, -10] })
                .addTo(state.map);
            state.markers[f.id] = marker;
        }
    });

    // Cleanup stale markers
    Object.keys(state.markers).forEach(id => {
        if (!currentIds.has(id)) {
            state.map.removeLayer(state.markers[id]);
            delete state.markers[id];
        }
    });
}

/**
 * Update Sidebar UI
 */
function updateUI() {
    const filtered = getFilteredFlights();
    elements.flightCount.textContent = state.flights.length;
    elements.visibleCount.textContent = `${filtered.length} visible`;

    elements.flightList.innerHTML = '';
    
    if (filtered.length === 0) {
        elements.flightList.innerHTML = '<li class="flight-placeholder">No matching flights in range</li>';
        return;
    }

    filtered.forEach(f => {
        const li = document.createElement('li');
        li.className = 'flight-item';
        li.innerHTML = `
            <div class="flight-info-main">
                <span class="flight-callsign">${f.callsign}</span>
                <span class="flight-reg">${f.reg}</span>
            </div>
            <div class="flight-metrics">
                <div class="metric-row">
                    <span class="metric-label">ALT</span>
                    <span>${formatAltShort(f.alt)}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">SPD</span>
                    <span>${Math.round(f.speed)}</span>
                </div>
            </div>
        `;

        li.addEventListener('click', () => {
            state.map.flyTo([f.lat, f.lng], 10, { duration: 1.5 });
            setTimeout(() => {
                if (state.markers[f.id]) state.markers[f.id].openPopup();
            }, 1000);
            
            // On mobile, hide sidebar after selection
            if (window.innerWidth < 768) toggleSidebar();
        });

        elements.flightList.appendChild(li);
    });
}

/**
 * Utilities
 */
function getFilteredFlights() {
    if (!state.searchQuery) return state.flights;
    const q = state.searchQuery.toLowerCase();
    return state.flights.filter(f => 
        f.callsign.toLowerCase().includes(q) || 
        f.reg.toLowerCase().includes(q)
    );
}

function handleSearch(e) {
    state.searchQuery = e.target.value;
    updateUI();
    renderMarkers();
}

function toggleSidebar() {
    state.sidebarHidden = !state.sidebarHidden;
    elements.sidebar.classList.toggle('hidden', state.sidebarHidden);
}

function recenterMap() {
    state.map.flyTo(CONFIG.INITIAL_VIEW, CONFIG.INITIAL_ZOOM, { duration: 1.5 });
}

function formatAlt(ft) {
    return ft <= 0 ? 'Ground' : `${ft.toLocaleString()} ft`;
}

function formatAltShort(ft) {
    if (ft <= 0) return 'GND';
    if (ft >= 1000) return `${Math.round(ft/1000)}k`;
    return ft;
}

// Start
window.addEventListener('DOMContentLoaded', init);
