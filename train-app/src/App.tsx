import { useState } from "react";
import "./App.css";

export default function App() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("train");

  return (
    <div className="app-container">

      {/* Floating Circular Button (Left Side) */}
      <button className="fab" onClick={() => setOpen(true)}>
        ≡
      </button>

      {/* Left Slide Panel */}
      <div className={`panel ${open ? "show" : ""}`}>

        {/* Close Button */}
        <button className="close-btn" onClick={() => setOpen(false)}>
          ×
        </button>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={tab === "train" ? "active" : ""}
            onClick={() => setTab("train")}
          >
            Train Location
          </button>

          <button
            className={tab === "notif" ? "active" : ""}
            onClick={() => setTab("notif")}
          >
            Notifications
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {tab === "train" && <p>Train location details will appear here.</p>}
          {tab === "notif" && <p>No new notifications.</p>}
        </div>

      </div>
    </div>
  );
}
