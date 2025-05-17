import { useState, useEffect } from "react";
import { vapi, startAssistant, stopAssistant } from "./ai";
import ActiveCallDetails from "./call/ActiveCallDetails";

// Compute “today” metadata using UTC and IANA zone
function getTodayInfo(timeZoneId) {
  const now = new Date();
  // ISO 8601 in UTC
  const today = now.toISOString();
  // Weekday name in user's timezone
  const dayOfWeek = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: timeZoneId,
  }).format(now);
  return { today, dayOfWeek, timeZone: timeZoneId };
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
      const meta = getTodayInfo(selectedTZ);
      console.log("Starting assistant with metadata:", meta);
      const data = await startAssistant(meta);
      console.log("Assistant started, callId =", data.id);
      setCallId(data.id);
    } catch (err) {
      console.error(err);
      alert("Error starting assistant — see console.");
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
      .catch((e) => {
        console.error(e);
        alert("Error fetching call details — see console.");
      });
  };

  return (
    <div className="app-container">
      {!started && !loading && !callResult && !loadingResult && (
        <div>
          <h2>Select Your Time Zone</h2>
          <select
            value={selectedTZ}
            onChange={(e) => setSelectedTZ(e.target.value)}
          >
            <option value={selectedTZ}>{`${selectedTZ} (Local)`}</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
          </select>
          <button onClick={handleStart} className="button">
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

      {loadingResult && <p>Loading call details…</p>}

      {callResult && (
        <div className="call-result">
          <p>
            Qualified: {callResult.analysis.structuredData.is_qualified.toString()}
          </p>
          <p>{callResult.summary}</p>
        </div>
      )}
    </div>
  );
}
