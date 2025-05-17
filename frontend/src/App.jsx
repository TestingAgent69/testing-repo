import { useState, useEffect } from "react";
import { vapi, startAssistant, stopAssistant } from "./ai";
import ActiveCallDetails from "./call/ActiveCallDetails";

// Helper to get current date/time info
function getTodayInfo() {
  const now = new Date();
  // Day of week
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  // ISO timestamp
  const iso = now.toISOString();
  // Timezone offset
  const timezoneOffset = (() => {
    const off = now.getTimezoneOffset();
    const sign = off <= 0 ? '+' : '-';
    const hrs = String(Math.abs(Math.floor(off / 60))).padStart(2, '0');
    const mins = String(Math.abs(off % 60)).padStart(2, '0');
    return `UTC${sign}${hrs}:${mins}`;
  })();

  return { date: now, dayOfWeek, iso, timezone: timezoneOffset };
}

function App() {
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
    // Grab current date/time context
    const todayInfo = getTodayInfo();
    // Pass today's context into assistant
    const data = await startAssistant({
      today: todayInfo.iso,
      dayOfWeek: todayInfo.dayOfWeek,
      timezone: todayInfo.timezone
    });
    setCallId(data.id);
  };

  const handleStop = () => {
    stopAssistant();
    getCallDetails();
  };

  const getCallDetails = (interval = 3000) => {
    setLoadingResult(true);
    fetch("/call-details?call_id=" + callId)
      .then((response) => response.json())
      .then((data) => {
        if (data.analysis && data.summary) {
          console.log(data);
          setCallResult(data);
          setLoadingResult(false);
        } else {
          setTimeout(() => getCallDetails(interval), interval);
        }
      })
      .catch((error) => alert(error));
  };

  return (
    <div className="app-container">
      {!loading && !started && !loadingResult && !callResult && (
        <button onClick={handleStart} className="button">
          Start Assistant
        </button>
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

export default App;
