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

            {/* Warning if IP-based or inaccurate */}
            {location.accuracy > 1500 && (
              <p style={{ color: "orange" }}>
                ⚠️ Location is inaccurate (likely IP-based). Device may not have GPS.
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
        <p> </p>
        <p> </p>
        <button className="logout-btn" onClick={logout}>
            Logout
        </button>
    </div>
  );
}
