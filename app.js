// Core Application Logic

// API Endpoint for ADSB Airplanes.live (Center of Finland, 250 Nautical Miles radius)
// This strictly circumvents previous generic OpenSky 429 bounds restrictions!
const API_URL = `https://api.airplanes.live/v2/point/64.0/26.0/250`;

// App State
let map;
let markers = {};
let globalFlights = [];

// DOM Elements
const flightCountEl = document.getElementById('flight-count');
const lastUpdatedEl = document.getElementById('last-updated');
const flightListEl = document.getElementById('flight-list');

// Initialize Map
function initMap() {
    map = L.map('map').setView([64.0, 26.0], 5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Initial Fetch (Continuous real data tracking)
    fetchFlights();
    
    // Refresh API Data Every 15 seconds (Airplanes.live handles anonymous tracking up to 1hz perfectly)
    // 10s is optimal for radar smooth network performance balancing bandwidth
    setInterval(fetchFlights, 10000);
    
    // Smooth Real-Time UI Updates (Interpolate positions every 1 second)
    setInterval(smoothUpdateRoutine, 1000);
}

const planeSVG = `
<svg class="plane-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 11.5L14 11.5L10 3L8.5 3L10.5 11.5L4 11.5L2.5 9.5L1 9.5L2.5 12.5L1 15.5L2.5 15.5L4 13.5L10.5 13.5L8.5 22L10 22L14 13.5L21 13.5C22.1 13.5 23 12.6 23 11.5C23 10.4 22.1 9.5 21 9.5L21 11.5Z"/>
</svg>
`;

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
}

function formatAlt(feet) {
    if (feet === undefined || feet === null) return 'N/A';
    if (feet === 'ground') return 'On Ground';
    return Number(feet).toLocaleString() + ' ft';
}

function formatSpeed(knots) {
    if (knots === undefined || knots === null) return 'N/A';
    return Math.round(knots) + ' kts';
}

// Fetch Flight Data from Free Airplanes.live Network
async function fetchFlights() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        const globalStates = data.ac || [];
        
        // Map Airplanes.live JSON Object structure seamlessly
        globalFlights = globalStates.map(state => ({
            id: state.hex,
            callsign: state.flight ? state.flight.trim() : 'Unknown',
            reg: state.r || 'N/A', // Registration mark e.g. OH-LVK
            lng: state.lon,
            lat: state.lat,
            alt: state.alt_baro, // Already in feet
            speed: state.gs, // in knots
            heading: state.track !== undefined ? state.track : 0
        })).filter(f => f.lat !== null && f.lng !== null);
        
        updateSidebar(globalFlights);
        
        // Push initial rendering of new batch so they appear immediately
        renderMapMarkers(globalFlights);
        
        flightCountEl.textContent = globalFlights.length;
        lastUpdatedEl.textContent = formatTime(new Date());
        
    } catch (error) {
        console.warn('Network Error fetching Airplanes.live data:', error);
        flightListEl.innerHTML = '<li class="flight-placeholder" style="color: #ef4444;">Connecting to Airplanes.live Stream...</li>';
    }
}

// Highly responsive fast routine updating plane positions smoothly using dead reckoning navigation math
function smoothUpdateRoutine() {
    if (globalFlights.length === 0) return;
    
    globalFlights.forEach(flight => {
        if (flight.speed && flight.heading !== null) {
             // flight.speed is in Knots. Conversion: 1 knot ≈ 0.514444 meters/second
            const velocityMps = flight.speed * 0.514444;
            const distanceMeters = velocityMps * 1;  // Dist over 1 second tick
            
            const dLat = (distanceMeters * Math.cos(flight.heading * Math.PI / 180)) / 111111;
            const dLng = (distanceMeters * Math.sin(flight.heading * Math.PI / 180)) / (111111 * Math.cos(flight.lat * Math.PI / 180));
            
            flight.lat += dLat;
            flight.lng += dLng;
        }
    });

    renderMapMarkers(globalFlights);
}

function renderMapMarkers(flights) {
    const currentFlightIds = new Set();
    flights.forEach(flight => {
        currentFlightIds.add(flight.id);
        const iconHtml = `<div class="plane-icon" style="transform: rotate(${flight.heading - 90}deg)">${planeSVG}</div>`;
        const customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
        const popupContent = `
            <div class="popup-title">${flight.callsign}</div>
            <div class="popup-detail"><strong>Reg:</strong> ${flight.reg}</div>
            <div class="popup-detail"><strong>Altitude:</strong> ${formatAlt(flight.alt)}</div>
            <div class="popup-detail"><strong>Speed:</strong> ${formatSpeed(flight.speed)}</div>
            <div class="popup-detail"><strong>Heading:</strong> ${Math.round(flight.heading)}&deg;</div>
        `;

        if (markers[flight.id]) {
            markers[flight.id].setLatLng([flight.lat, flight.lng]);
            markers[flight.id].setIcon(customIcon);
            if (!markers[flight.id].isPopupOpen()) {
               markers[flight.id].setPopupContent(popupContent);
            }
        } else {
            const marker = L.marker([flight.lat, flight.lng], { icon: customIcon })
                .bindPopup(popupContent)
                .addTo(map);
            markers[flight.id] = marker;
        }
    });

    Object.keys(markers).forEach(id => {
        if (!currentFlightIds.has(id)) {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    });
}

function updateSidebar(flights) {
    flightListEl.innerHTML = '';
    
    if (flights.length === 0) {
        flightListEl.innerHTML = '<li class="flight-placeholder">No live flights mapped in airspace natively</li>';
        return;
    }

    flights.forEach(flight => {
        const listItem = document.createElement('li');
        listItem.className = 'flight-item';
        listItem.innerHTML = `
            <div class="flight-callsign">${flight.callsign}</div>
            <div class="flight-details">
                <span>${formatAlt(flight.alt)}</span>
                <span>${formatSpeed(flight.speed)}</span>
            </div>
        `;
        
        listItem.addEventListener('click', () => {
            map.flyTo([flight.lat, flight.lng], 8, { duration: 1 });
            markers[flight.id].openPopup();
        });

        flightListEl.appendChild(listItem);
    });
}

window.addEventListener('DOMContentLoaded', initMap);
