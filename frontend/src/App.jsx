import { useState, useEffect } from "react";
import { vapi, startAssistant, stopAssistant } from "./ai";
import ActiveCallDetails from "./call/ActiveCallDetails";

// Compute “today” metadata but do NOT display it on screen
function getTodayInfo() {
  const now = new Date();
  // e.g. "Sunday"
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
  // ISO timestamp, e.g. "2025-05-17T13:45:30.000Z"
  const iso = now.toISOString();
  // e.g. "UTC+05:30"
  const timezoneOffset = (() => {
    const off = now.getTimezoneOffset();
    const sign = off <= 0 ? "+" : "-";
    const hrs = String(Math.abs(Math.floor(off / 60))).padStart(2, "0");
    const mins = String(Math.abs(off % 60)).padStart(2, "0");
    return `UTC${sign}${hrs}:${mins}`;
  })();

  return { today: iso, dayOfWeek, timezone: timezoneOffset };
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callId, setCallId] = useState("");
  const [callResult, setCallResult] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);

  // Wire up VAPI event listeners
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

  // User clicks “Start Assistant”
  const handleStart = async () => {
    setLoading(true);

    // 1) Compute today metadata
    const todayInfo = getTodayInfo();

    // 2) Build a single user message from the input field
    const userMessage = {
      role: "user",
      content: bookingDate  // from state (see below)
    };

    // 3) Start the assistant, sending system + user message
    const data = await startAssistant(
      todayInfo,
      [userMessage]
    );

    setCallId(data.id);
  };

  const handleStop = () => {
    stopAssistant();
    getCallDetails();
  };

  // Poll for results
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

  // Local state for the user’s free-form date request
  const [bookingDate, setBookingDate] = useState("");

  return (
    <div className="app-container">
      {!loading && !started && !loadingResult && !callResult && (
        <>
          <h1>Book a call with the Assistant</h1>
          <input
            type="text"
            placeholder="e.g. Sunday at 3pm"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
          />
          <button onClick={handleStart} className="button">
            Start Assistant
          </button>
        </>
      )}

      {loadingResult && <p>Loading call details... please wait</p>}

      {!loadingResult && callResult && (
        <div className="call-result">
          <p>
            Qualified: {callResult.analysis.structuredData.is_qualified.toString()}
          </p>
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
