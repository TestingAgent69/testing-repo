import { useState, useEffect } from "react";
import { vapi, startAssistant, stopAssistant } from "./ai";
import ActiveCallDetails from "./call/ActiveCallDetails";

// Compute “today” metadata based on selected IANA time zone
function getTodayInfo(timeZoneId) {
  const now = new Date();
  // Format a full ISO-like string in the target timezone
  const isoFormatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timeZoneId,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const [[,, datePart], [timePart]] = isoFormatter.formatToParts(now)
    .reduce((acc, part) => {
      if (part.type === 'year' || part.type === 'month' || part.type === 'day') acc[0].push(part.value);
      if (part.type === 'hour' || part.type === 'minute' || part.type === 'second') acc[1].push(part.value);
      return acc;
    }, [[], []]);
  const iso = `${datePart.replace(/-/g, '-') }T${timePart}`;

  // Day of week in that timezone
  const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timeZoneId }).format(now);

  return { today: iso, dayOfWeek, timeZone: timeZoneId };
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callId, setCallId] = useState("");
  const [callResult, setCallResult] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);

  // Let user pick an IANA timezone
  const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [selectedTZ, setSelectedTZ] = useState(localTZ);

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
      .on("speech-start", () => {
        setAssistantIsSpeaking(true);
      })
      .on("speech-end", () => {
        setAssistantIsSpeaking(false);
      })
      .on("volume-level", (level) => {
        setVolumeLevel(level);
      });
  }, []);

  const handleStart = async () => {
    setLoading(true);

    // Compute metadata for the selected timezone
    const todayInfo = getTodayInfo(selectedTZ);

    // Start assistant with only today metadata
    const data = await startAssistant(todayInfo);
    setCallId(data.id);
  };

  const handleStop = () => {
    stopAssistant();
    getCallDetails();
  };

  const getCallDetails = (interval = 3000) => {
    setLoadingResult(true);
    fetch("/call-details?call_id=" + callId)
      .then((r) => r.json())
      .then((data) => {
        if (data.analysis && data.summary) {
          setCallResult(data);
          setLoadingResult(false);
        } else {
          setTimeout(() => getCallDetails(interval), interval);
        }
      })
      .catch((err) => alert(err));
  };

  return (
    <div className="app-container">
      {!loading && !started && !loadingResult && !callResult && (
        <div>
          <h2>Select Your Time Zone</h2>
          <select value={selectedTZ} onChange={e => setSelectedTZ(e.target.value)}>
            <option value={localTZ}>{localTZ} (Local)</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            {/* Add more IANA zones as needed */}
          </select>
          <button onClick={handleStart} className="button" style={{ marginLeft: '1rem' }}>
            Start Assistant
          </button>
        </div>
      )}

      {loadingResult && <p>Loading call details... please wait</p>}

      {!loadingResult && callResult && (
        <div className="call-result">
          <p>Qualified: {callResult.analysis.structuredData.is_qualified.toString()}</p>
          <p>{callResult.summary}</p>
        </div>
      )}

      {(loading || loadingResult) && <div className="loading"></div>}

      {started && (
        <ActiveCallDetails
          assistantIsSpeaking={assistantIsSpeaking}
          volumeLevel={volumeLevel}
          endCallCallback={handleStop}
        />
      )}
    </div>
  );
}
