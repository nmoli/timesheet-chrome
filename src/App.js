import React, { useState, useEffect } from "react";
import apiService from "./apiService";
import "./App.css";

function App() {
  const [labels, setLabels] = useState([]);
  const [newLabel, setNewLabel] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load data from API on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      // Load labels from API
      const labelsData = await apiService.getLabels();
      setLabels(labelsData);

      // Load completed sessions from API
      const sessionsData = await apiService.getSessions();
      setSessionHistory(sessionsData);

      // Load current session and selected label from localStorage
      const savedCurrentSession = localStorage.getItem(
        "timesheet-current-session"
      );
      const savedSelectedLabel = localStorage.getItem(
        "timesheet-selected-label"
      );

      if (savedCurrentSession) {
        const parsedSession = JSON.parse(savedCurrentSession);
        setCurrentSession(parsedSession);
        // Calculate elapsed time immediately when loading current session
        const now = new Date().getTime();
        const startTime = new Date(parsedSession.startTime).getTime();
        setElapsedTime(now - startTime);
      }
      if (savedSelectedLabel) {
        setSelectedLabel(savedSelectedLabel);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Failed to load data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Timer for current session
  useEffect(() => {
    let interval;
    if (currentSession) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const startTime = new Date(currentSession.startTime).getTime();
        setElapsedTime(now - startTime);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentSession]);

  const handleAddLabel = async () => {
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      try {
        await apiService.createLabel(newLabel.trim());
        setLabels([...labels, newLabel.trim()]);
        setNewLabel("");
        setError("");
      } catch (err) {
        setError("Failed to add label. Please try again.");
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleAddLabel();
  };

  const handleDeleteSelected = async () => {
    if (selectedLabel) {
      try {
        await apiService.deleteLabel(selectedLabel);
        setLabels(labels.filter((label) => label !== selectedLabel));
        setSelectedLabel("");
        setError("");
      } catch (err) {
        setError("Failed to delete label. Please try again.");
      }
    }
  };

  const handleClockIn = async () => {
    if (selectedLabel && !currentSession) {
      try {
        const newSession = {
          label: selectedLabel,
          startTime: new Date().toISOString(),
          id: Date.now(),
        };

        // Save current session to localStorage only
        setCurrentSession(newSession);
        localStorage.setItem(
          "timesheet-current-session",
          JSON.stringify(newSession)
        );

        setError("");
      } catch (err) {
        setError("Failed to start session. Please try again.");
      }
    }
  };

  const handleClockOut = async () => {
    if (currentSession) {
      try {
        const endTime = new Date().toISOString();
        const duration =
          new Date(endTime).getTime() -
          new Date(currentSession.startTime).getTime();

        const completedSession = {
          ...currentSession,
          endTime,
          duration,
        };

        // Save completed session to MongoDB
        await apiService.createSession(completedSession);

        // Update local state
        setSessionHistory([completedSession, ...sessionHistory]);
        setCurrentSession(null);

        // Clear current session from localStorage
        localStorage.removeItem("timesheet-current-session");

        setError("");
      } catch (err) {
        setError("Failed to end session. Please try again.");
      }
    }
  };

  const handleDeleteSession = async (sessionId) => {
    const sessionToDelete = sessionHistory.find(
      (session) => session._id === sessionId || session.id === sessionId
    );
    if (sessionToDelete) {
      console.log("Attempting to delete session:", sessionToDelete);
      console.log("Session ID to delete:", sessionId);
      console.log("Session has _id:", sessionToDelete._id);
      console.log("Session has id:", sessionToDelete.id);

      const confirmed = window.confirm(
        `Are you sure you want to delete this session?\n\n` +
          `Label: ${sessionToDelete.label}\n` +
          `Duration: ${formatDuration(sessionToDelete.duration)}\n` +
          `Started: ${formatDate(sessionToDelete.startTime)}`
      );
      if (confirmed) {
        try {
          // Use the custom 'id' field (timestamp) for deletion
          const idToDelete = sessionToDelete.id;
          console.log("Deleting with ID:", idToDelete);

          await apiService.deleteSession(idToDelete);
          setSessionHistory(
            sessionHistory.filter((session) => session.id !== idToDelete)
          );
          setError("");
        } catch (err) {
          console.error("Delete error:", err);
          setError("Failed to delete session. Please try again.");
        }
      }
    }
  };
  const formatDuration = (milliseconds) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };
  const formatDate = (dateString) => new Date(dateString).toLocaleString();
  const getSessionsByLabel = () => {
    const grouped = {};
    sessionHistory.forEach((session) => {
      if (!grouped[session.label]) grouped[session.label] = [];
      grouped[session.label].push(session);
    });
    return grouped;
  };
  const getTotalTimeForLabel = (sessions) =>
    sessions.reduce((total, session) => total + session.duration, 0);
  const groupedSessions = getSessionsByLabel();

  return (
    <div className="App">
      <div className="container">
        {/* Add new label section */}
        <div className="add-label-section">
          <h3>Add New Label</h3>
          <div className="input-group">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter a new label..."
              className="label-input"
            />
            <button
              onClick={handleAddLabel}
              className="add-button"
              disabled={!newLabel.trim()}
            >
              Add
            </button>
          </div>
        </div>
        {/* Select existing label section */}
        <div className="select-label-section">
          <h3>Select Label</h3>
          {labels.length === 0 ? (
            <p className="no-labels">
              No labels added yet. Add your first label above!
            </p>
          ) : (
            <div className="select-group">
              <select
                value={selectedLabel}
                onChange={(e) => {
                  const newSelectedLabel = e.target.value;
                  setSelectedLabel(newSelectedLabel);

                  // Save selected label to localStorage
                  if (newSelectedLabel) {
                    localStorage.setItem(
                      "timesheet-selected-label",
                      newSelectedLabel
                    );
                  } else {
                    localStorage.removeItem("timesheet-selected-label");
                  }
                }}
                className="label-select"
              >
                <option value="">Choose a label...</option>
                {labels.map((label, index) => (
                  <option key={index} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              {selectedLabel && (
                <button
                  onClick={handleDeleteSelected}
                  className="delete-button"
                  title="Delete selected label"
                >
                  Delete Selected
                </button>
              )}
            </div>
          )}
        </div>
        {/* Clock in/out section */}
        <div className="clock-section">
          <h3>Time Tracking</h3>
          {currentSession ? (
            <div className="active-session">
              <div className="session-info">
                <p>
                  Currently tracking: <strong>{currentSession.label}</strong>
                </p>
                <p className="elapsed-time">
                  Elapsed: {formatDuration(elapsedTime)}
                </p>
                <p className="session-start">
                  Started: {formatDate(currentSession.startTime)}
                </p>
              </div>
              <button onClick={handleClockOut} className="clock-out-button">
                Clock Out
              </button>
            </div>
          ) : (
            <div className="clock-in-section">
              <button
                onClick={handleClockIn}
                className="clock-in-button"
                disabled={!selectedLabel}
              >
                Clock In
              </button>
              {!selectedLabel && (
                <p className="no-label-selected">
                  Select a label to start tracking time
                </p>
              )}
            </div>
          )}
        </div>

        {/* System messages - moved here to reduce height fluctuations */}
        {loading && <div className="loading-message">Loading data...</div>}
        {error && <div className="error-message">{error}</div>}

        {/* Session history section */}
        {sessionHistory.length > 0 && (
          <div className="history-section">
            <h3>Session History</h3>
            <div className="history-content">
              {Object.entries(groupedSessions).map(([label, sessions]) => {
                const totalTime = getTotalTimeForLabel(sessions);
                return (
                  <div key={label} className="label-group">
                    <div className="label-header">
                      <h4>{label}</h4>
                      <span className="total-time">
                        Total: {formatDuration(totalTime)}
                      </span>
                    </div>
                    <div className="sessions-list">
                      {sessions.map((session) => (
                        <div
                          key={session._id || session.id}
                          className="session-item"
                        >
                          <div className="session-item-top-row">
                            <div className="session-details">
                              <span className="session-date">
                                {formatDate(session.startTime)}
                              </span>
                              <span className="session-duration">
                                {formatDuration(session.duration)}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                handleDeleteSession(session._id || session.id)
                              }
                              className="delete-session-button"
                              title="Delete this session"
                            >
                              ×
                            </button>
                          </div>
                          {session.notes && (
                            <div className="session-item-bottom-row">
                              <div className="session-note">
                                {session.notes}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
