import { useState, useEffect } from "react";
import { vapi, startAssistant, stopAssistant } from "./ai";
import ActiveCallDetails from "./call/ActiveCallDetails";

// Compute “today” metadata in a given IANA timezone
function getTodayInfo(timeZoneId) {
  const now = new Date();

  // Build an ISO-like timestamp in that zone
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timeZoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(now)
    .reduce(
      (acc, p) => {
        if (p.type === "year" || p.type === "month" || p.type === "day")
          acc.date.push(p.value);
        if (p.type === "hour" || p.type === "minute" || p.type === "second")
          acc.time.push(p.value);
        return acc;
      },
      [[], []]
    );

  const datePart = parts[0].join("-");
  const timePart = parts[1].join(":");
  const iso = `${datePart}T${timePart}`;

  // Day of week in that timezone
  const dayOfWeek = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: timeZoneId,
  }).format(now);

  return { today: iso, dayOfWeek, timeZone: timeZoneId };
}

export default function App() {
  const [selectedTZ, setSelectedTZ] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callId, setCallId] = useState("");
  const [callResult, setCallResult] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);

  // VAPI event listeners
  useEffect(() => {
    vapi
      .on("call-start", () => {
        setLoading(false);
        setStarted(true);
      })
      .on("call-end", () => {
        setStarted(false);
        setLoading(false);
      })
      .on("speech-start", () => setAssistantIsSpeaking(true))
      .on("speech-end", () => setAssistantIsSpeaking(false))
      .on("volume-level", (lvl) => setVolumeLevel(lvl));
  }, []);

  const handleStart = async () => {
    try {
      setLoading(true);
      const todayInfo = getTodayInfo(selectedTZ);
      console.log("▶️ Starting assistant with metadata:", todayInfo);
      const data = await startAssistant(todayInfo);
      console.log("✅ Assistant started, callId =", data.id);
      setCallId(data.id);
    } catch (err) {
      alert("Error starting assistant—check console for details.");
      setLoading(false);
    }
  };

  const handleStop = () => {
    stopAssistant();
    pollForResults();
  };

  const pollForResults = (interval = 3000) => {
    setLoadingResult(true);
    fetch(`/call-details?call_id=${callId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.analysis && data.summary) {
          setCallResult(data);
          setLoadingResult(false);
        } else {
          setTimeout(() => pollForResults(interval), interval);
        }
      })
      .catch((err) => {
        alert("Error fetching call details—check console.");
        console.error(err);
      });
  };

  return (
    <div className="app-container">
      {/* always show timezone picker & start button */}
      {!started && !loading && !loadingResult && !callResult && (
        <div>
          <h2>Select Your Time Zone</h2>
          <select
            value={selectedTZ}
            onChange={(e) => setSelectedTZ(e.target.value)}
          >
            <option value={selectedTZ}>
              {selectedTZ} (Local)
            </option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            {/* add more IANA zones here */}
          </select>
          <button
            onClick={handleStart}
            className="button"
            style={{ marginLeft: "1rem" }}
          >
            Start Assistant
          </button>
        </div>
      )}

      {loading && <div className="loading">Loading…</div>}

      {started && (
        <ActiveCallDetails
          assistantIsSpeaking={assistantIsSpeaking}
          volumeLevel={volumeLevel}
          endCallCallback={handleStop}
        />
      )}

      {loadingResult && <p>Loading call details… please wait</p>}

      {callResult && (
        <div className="call-result">
          <p>
            Qualified:{" "}
            {callResult.analysis.structuredData.is_qualified.toString()}
          </p>
          <p>{callResult.summary}</p>
        </div>
      )}
    </div>
  );
}
