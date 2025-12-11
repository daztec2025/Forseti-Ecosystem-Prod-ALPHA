"""
Forseti iRacing Bridge Service

A lightweight Python FastAPI service that connects to the iRacing racing simulator
and exposes telemetry data via a REST API. This bridge enables the Forseti web/electron
applications to capture real-time racing data including speed, inputs, lap times,
and session information.

Features:
    - Real-time telemetry data streaming (speed, rpm, throttle, brake, steering)
    - Session information retrieval (track, car, driver)
    - Lap time tracking
    - Connection status monitoring
    - Data caching for resilience

API Endpoints:
    GET /           - API root and version info
    GET /status     - Connection status to iRacing
    GET /telemetry  - Current telemetry data
    GET /session    - Session/track/car information
    POST /disconnect - Disconnect from iRacing

Usage:
    Run the service: python main.py
    Access at: http://localhost:5555

Requirements:
    - Windows (iRacing SDK is Windows-only)
    - iRacing must be running
    - pyirsdk package installed

Author: Forseti Development Team
Version: 1.0.0
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import irsdk
import uvicorn
from typing import Optional, Dict, Any
import time

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    try:
        ir.shutdown()
    except:
        pass

app = FastAPI(title="Forseti iRacing Bridge", version="1.0.0", lifespan=lifespan)

# Enable CORS for Electron app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global iRacing SDK instance
ir = irsdk.IRSDK()
last_telemetry_update = 0
telemetry_cache = {}
session_cache = {}


def is_connected() -> bool:
    """
    Check if connected to iRacing.

    Returns:
        bool: True if SDK is initialized and connected to iRacing, False otherwise.
    """
    return ir.is_initialized and ir.is_connected


def ensure_connection() -> bool:
    """
    Ensure connection to iRacing, attempting to connect if not already connected.

    This function checks the current connection state and attempts to initialize
    the SDK and establish a connection if needed. It includes a brief delay to
    allow the connection to stabilize.

    Returns:
        bool: True if connection is established, False otherwise.

    Note:
        The SDK must be initialized before it can connect to iRacing.
        iRacing must be running for the connection to succeed.
    """
    if not ir.is_initialized:
        ir.startup()

    if not ir.is_connected:
        # Try to connect
        ir.startup()
        time.sleep(0.1)  # Give it a moment

    return ir.is_connected


@app.get("/")
def root():
    """
    API root endpoint.

    Returns basic service information and confirms the API is running.

    Returns:
        dict: Service name, version, and status.
    """
    return {
        "service": "Forseti iRacing Bridge",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/status")
def get_status():
    """
    Get current connection status to iRacing.

    Checks if the SDK is initialized and connected to the iRacing simulation.
    Will attempt to establish connection if not already connected.

    Returns:
        dict: Connection status with fields:
            - connected (bool): Whether connected to iRacing
            - initialized (bool): Whether SDK is initialized
            - timestamp (float): Unix timestamp of status check
            - error (str, optional): Error message if connection failed
    """
    try:
        connected = ensure_connection()
        return {
            "connected": connected,
            "initialized": ir.is_initialized,
            "timestamp": time.time()
        }
    except Exception as e:
        return {
            "connected": False,
            "initialized": False,
            "error": str(e),
            "timestamp": time.time()
        }


@app.get("/telemetry")
def get_telemetry():
    """
    Get current telemetry data from iRacing.

    Retrieves real-time car telemetry including speed, engine data, and driver inputs.
    Data is cached to provide resilience if the connection is temporarily lost.

    Returns:
        dict: Telemetry data with fields:
            - speed (float): Current speed in m/s
            - rpm (float): Engine RPM
            - gear (int): Current gear (-1=reverse, 0=neutral, 1-7=forward)
            - throttle (float): Throttle position (0-1)
            - brake (float): Brake pressure (0-1)
            - steering (float): Steering wheel angle in radians
            - lapCurrentLapTime (float): Current lap elapsed time in seconds
            - lapLastLapTime (float): Previous lap time in seconds
            - lapNumber (int): Current lap number
            - sessionTime (float): Total session time in seconds
            - sessionTimeRemain (float): Remaining session time
            - isOnTrack (bool): Whether car is on track
            - lapDistPct (float): Lap progress (0-1)
            - trackLength (float): Track length in meters
            - timestamp (float): Unix timestamp

    Raises:
        HTTPException 503: Not connected to iRacing
        HTTPException 500: Error reading telemetry data
    """
    global last_telemetry_update, telemetry_cache

    if not ensure_connection():
        raise HTTPException(status_code=503, detail="Not connected to iRacing")

    try:
        # Freeze the data to get consistent values
        ir.freeze_var_buffer_latest()

        # Get key telemetry values
        telemetry = {
            "speed": ir["Speed"] if ir["Speed"] is not None else 0,
            "rpm": ir["RPM"] if ir["RPM"] is not None else 0,
            "gear": ir["Gear"] if ir["Gear"] is not None else 0,
            "throttle": ir["Throttle"] if ir["Throttle"] is not None else 0,
            "brake": ir["Brake"] if ir["Brake"] is not None else 0,
            "steering": ir["SteeringWheelAngle"] if ir["SteeringWheelAngle"] is not None else 0,
            "lapCurrentLapTime": ir["LapCurrentLapTime"] if ir["LapCurrentLapTime"] is not None else 0,
            "lapLastLapTime": ir["LapLastLapTime"] if ir["LapLastLapTime"] is not None else 0,
            "lapNumber": ir["Lap"] if ir["Lap"] is not None else 0,
            "sessionTime": ir["SessionTime"] if ir["SessionTime"] is not None else 0,
            "sessionTimeRemain": ir["SessionTimeRemain"] if ir["SessionTimeRemain"] is not None else 0,
            "isOnTrack": ir["IsOnTrack"] if ir["IsOnTrack"] is not None else False,
            "lapDistPct": ir["LapDistPct"] if ir["LapDistPct"] is not None else 0,  # Lap distance as percentage (0-1)
            "trackLength": (ir["TrackLength"] * 1000) if ir["TrackLength"] is not None else 0,  # Track length in meters
            "timestamp": time.time()
        }

        telemetry_cache = telemetry
        last_telemetry_update = time.time()

        return telemetry

    except Exception as e:
        if telemetry_cache:
            # Return cached data if available
            return telemetry_cache
        raise HTTPException(status_code=500, detail=f"Error reading telemetry: {str(e)}")


@app.get("/session")
def get_session():
    """
    Get current session information from iRacing.

    Retrieves metadata about the current racing session including track,
    car, driver information, and fastest lap time.

    Returns:
        dict: Session data with fields:
            - trackName (str): Display name of the track
            - trackId (int): Internal track identifier
            - sessionType (str): Type of session (Practice, Race, etc.)
            - driverName (str): Name of the current driver
            - carName (str): Name of the car being driven
            - fastestLap (float): Fastest lap time in seconds (0 if none)
            - trackLength (float): Track length in meters
            - timestamp (float): Unix timestamp

    Raises:
        HTTPException 503: Not connected to iRacing
        HTTPException 404: Session info not yet available
        HTTPException 500: Error reading session data
    """
    global session_cache

    if not ensure_connection():
        raise HTTPException(status_code=503, detail="Not connected to iRacing")

    try:
        session_info = ir["WeekendInfo"]
        driver_info = ir["DriverInfo"]

        if not session_info or not driver_info:
            if session_cache:
                return session_cache
            raise HTTPException(status_code=404, detail="Session info not available")

        # Get fastest lap from session results
        fastest_lap = 0
        session_results = ir["SessionInfo"]
        if session_results and "Sessions" in session_results:
            for session in session_results["Sessions"]:
                if "ResultsFastestLap" in session:
                    for result in session["ResultsFastestLap"]:
                        if "FastestTime" in result and result["FastestTime"] > 0:
                            if fastest_lap == 0 or result["FastestTime"] < fastest_lap:
                                fastest_lap = result["FastestTime"]

        # Get track length in meters (TrackLength is in km)
        track_length_km = ir["TrackLength"] if ir["TrackLength"] is not None else 0
        track_length_m = track_length_km * 1000  # Convert km to meters

        # Freeze the var buffer to get consistent telemetry values for temperature
        ir.freeze_var_buffer_latest()

        # Get track temperature (Celsius) - use TrackTempCrew as TrackTemp is deprecated
        track_temp = ir["TrackTempCrew"] if ir["TrackTempCrew"] is not None else None

        # Get air temperature (Celsius)
        air_temp = ir["AirTemp"] if ir["AirTemp"] is not None else None

        # Determine track condition (dry/wet) based on track wetness
        # TrackWetness enum: 0=unknown, 1=dry, 2=mostly_dry, 3=very_lightly_wet,
        # 4=lightly_wet, 5=moderately_wet, 6=very_wet, 7=extremely_wet
        track_wetness = ir["TrackWetness"] if ir["TrackWetness"] is not None else 1
        track_condition = "wet" if track_wetness >= 3 else "dry"

        session_data = {
            "trackName": session_info.get("TrackDisplayName", "Unknown") if session_info else "Unknown",
            "trackId": session_info.get("TrackID", 0) if session_info else 0,
            "sessionType": session_info.get("SessionType", "Unknown") if session_info else "Unknown",
            "driverName": driver_info["Drivers"][driver_info["DriverCarIdx"]]["UserName"] if driver_info else "Unknown",
            "carName": driver_info["Drivers"][driver_info["DriverCarIdx"]]["CarScreenName"] if driver_info else "Unknown",
            "fastestLap": fastest_lap,
            "trackLength": track_length_m,  # Track length in meters
            "trackTemperature": track_temp,  # Track surface temperature in Celsius
            "airTemperature": air_temp,  # Air temperature in Celsius
            "trackCondition": track_condition,  # dry or wet
            "timestamp": time.time()
        }

        session_cache = session_data
        return session_data

    except Exception as e:
        if session_cache:
            return session_cache
        raise HTTPException(status_code=500, detail=f"Error reading session: {str(e)}")


@app.post("/disconnect")
def disconnect():
    """Disconnect from iRacing"""
    try:
        ir.shutdown()
        return {"status": "disconnected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error disconnecting: {str(e)}")


if __name__ == "__main__":
    print("Forseti iRacing Bridge starting...")
    print("Listening on http://localhost:5555")
    print("Waiting for iRacing connection...")

    uvicorn.run(app, host="127.0.0.1", port=5555, log_level="info")
