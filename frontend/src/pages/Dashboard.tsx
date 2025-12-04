import { useEffect, useState } from "react";
import { getLocation } from "../utils/location";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [location, setLocation] = useState<{
    lat: number;
    lon: number;
    accuracy: number;
    source: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState("");

  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const fetchLocation = () => {
    setError(null);

    getLocation(
      (pos, source) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source,
        });
      },
      (errMsg) => {
        setError(errMsg);
      }
    );
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  // SEND ALARM/BRAKE COMMAND TO API
  const sendCommandToAPI = async (
    device: "ALARM" | "BRAKE",
    state: "ON" | "OFF"
  ) => {
    try {
      setApiStatus(`Sending ${device} ${state}...`);

      const res = await fetch("http://localhost:4000/data/esp32/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ device, state }),
      });

      const data = await res.json();
      setApiStatus(`${data.message}`);
    } catch (err) {
      setApiStatus("Failed to send command");
    }
  };

  return (
    <div className="page-wrapper fade-in">
      <h2>Dashboard</h2>

      <div style={{ marginTop: "20px" }}>
        {error && <p style={{ color: "red" }}>{error}</p>}

        {location ? (
          <div className="location-box">
            <p>Latitude: {location.lat}</p>
            <p>Longitude: {location.lon}</p>

            <p>
              <strong>Accuracy:</strong> {Math.round(location.accuracy)} m
            </p>
            <p>
              <strong>Location Source:</strong> {location.source}
            </p>

            {location.accuracy > 1500 && (
              <p style={{ color: "orange" }}>
                ⚠️ Location is inaccurate (likely IP-based).
              </p>
            )}
          </div>
        ) : (
          !error && <p>Fetching location...</p>
        )}
      </div>

      <button onClick={fetchLocation} style={{ marginTop: "10px" }}>
        Refresh Location
      </button>

      {/* RELAY CONTROL PANEL */}
      <div style={{ marginTop: "30px" }}>
        <h3>Relay Control Panel</h3>

        {/* ALARM */}
        <div style={{ marginBottom: "10px" }}>
          <strong>ALARM:</strong>
          <button
            onClick={() => sendCommandToAPI("ALARM", "ON")}
            style={{ marginLeft: "10px" }}
          >
            ON
          </button>
          <button
            onClick={() => sendCommandToAPI("ALARM", "OFF")}
            style={{ marginLeft: "10px" }}
          >
            OFF
          </button>
        </div>

        {/* BRAKE */}
        <div>
          <strong>BRAKE:</strong>
          <button
            onClick={() => sendCommandToAPI("BRAKE", "ON")}
            style={{ marginLeft: "10px" }}
          >
            ON
          </button>
          <button
            onClick={() => sendCommandToAPI("BRAKE", "OFF")}
            style={{ marginLeft: "10px" }}
          >
            OFF
          </button>
        </div>

        {apiStatus && <p style={{ marginTop: "10px" }}>{apiStatus}</p>}
      </div>

      <p> </p>
      <button className="logout-btn" onClick={logout}>
        Logout
      </button>
    </div>
  );
}
