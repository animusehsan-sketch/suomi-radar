# Suomi Radar - Live Finland Flights

Suomi Radar is a modern, responsive flight tracking web application designed specifically to visualize real-time air traffic over Finland. It utilizes the free [Airplanes.live](https://airplanes.live) API to gather live flight data and seamlessly displays it on an interactive map.

## Features
- **Real-Time Tracking**: Continuously fetches and updates live flight data using the Airplanes.live API.
- **Interactive Map**: Displays flights visually using Leaflet.js with smooth custom map tiles.
- **Live Statistics**: Displays the total count of active flights tracked and the last update timestamp.
- **Sleek UI/UX**: Includes a beautifully designed glassmorphism sidebar, dark theme, and custom visual markers.
- **Responsive**: Fully functional on both desktop and mobile devices.

## Tech Stack
- **HTML5/CSS3**: Structured layout and modern styling variables with a glassmorphic aesthetic.
- **JavaScript (Vanilla)**: Fetching API data, processing aircraft objects, and DOM manipulation.
- **Leaflet.js**: Open-source JavaScript library for mobile-friendly interactive maps.
- **Airplanes.live API**: Provides non-rate-limited access to live ADS-B data.

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/suomi-radar.git
   ```

2. **Navigate to the project folder:**
   ```bash
   cd suomi-radar
   ```

3. **Run a local server:**
   You can use `npx serve`, Python's HTTP server, or Visual Studio Code Live Server to view the project:
   ```bash
   npx serve .
   ```

4. **Open your browser:**
   Open `http://localhost:3000` (or your local server's address) to see the live flight radar.

## License
This project is for educational purposes. Data provided by [Airplanes.live](https://airplanes.live). Map data © OpenStreetMap contributors.
