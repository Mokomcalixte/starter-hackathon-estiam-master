import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const socket = io("http://localhost:3000");

function parseEngineMetadata(session) {
  if (!session?.engineMetadata) return null;
  if (typeof session.engineMetadata === "object") return session.engineMetadata;

  try {
    return JSON.parse(session.engineMetadata);
  } catch {
    return null;
  }
}

export default function WatchRoom({ session, onBack, onSessionUpdate }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [engineStatus, setEngineStatus] = useState(
    session?.engineStatus || (parseEngineMetadata(session) ? "ready" : "idle")
  );
  const [engineMetadata, setEngineMetadata] = useState(() =>
    parseEngineMetadata(session)
  );
  const [subtitleLang, setSubtitleLang] = useState("");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [participants, setParticipants] = useState(() => {
    const initialParticipants = [
      session?.presenterName,
      session?.currentUserName || "Vous",
    ].filter(Boolean);

    return [...new Set(initialParticipants)];
  });
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");

  useEffect(() => {
    const metadata = parseEngineMetadata(session);

    setEngineMetadata(metadata);
    setEngineStatus(session?.engineStatus || (metadata ? "ready" : "idle"));
    setSubtitleLang(metadata?.language || "");
  }, [session]);

  useEffect(() => {
    if (!session?.code) return;

    setParticipants(
      [...new Set([session.presenterName, session.currentUserName].filter(Boolean))]
    );
    setMessages([]);

    function mergeMessage(nextMessage) {
      setMessages((prev) => {
        if (nextMessage.id && prev.some((message) => message.id === nextMessage.id)) {
          return prev;
        }

        return [...prev, nextMessage];
      });
    }

    function joinSession() {
      socket.emit("join-session", {
        code: session.code,
        username: session.currentUserName,
      });
    }

    function handleParticipantList(data) {
      const visibleParticipants = [
        session.presenterName,
        ...(data.participants || []),
      ].filter(Boolean);

      setParticipants([...new Set(visibleParticipants)]);
    }

    function handleChatHistory(data) {
      setMessages(data.messages || []);
    }

    function handleVideoControl(data) {
      if (!videoRef.current) return;

      if (data.action === "play") {
        videoRef.current.currentTime = data.time;
        videoRef.current.play();
      }

      if (data.action === "pause") {
        videoRef.current.currentTime = data.time;
        videoRef.current.pause();
      }

      if (data.action === "seek") {
        videoRef.current.currentTime = data.time;
      }
    }

    function handleChatMessage(data) {
      mergeMessage(data);
    }

    socket.on("connect", joinSession);
    socket.on("participant-list", handleParticipantList);
    socket.on("chat-history", handleChatHistory);
    socket.on("video-control", handleVideoControl);
    socket.on("chat-message", handleChatMessage);

    if (socket.connected) {
      joinSession();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", joinSession);
      socket.off("participant-list", handleParticipantList);
      socket.off("chat-history", handleChatHistory);
      socket.off("video-control", handleVideoControl);
      socket.off("chat-message", handleChatMessage);
    };
  }, [session?.code, session?.currentUserName, session?.presenterName]);

  if (!session) {
    return (
      <div className="watch-page">
        <button onClick={onBack}>← Retour</button>
        <h1>Aucune session sélectionnée</h1>
      </div>
    );
  }

  function emitVideoControl(action, time) {
    if (!session.isPresenter) return;

    socket.emit("video-control", {
      code: session.code,
      action,
      time,
    });
  }

  function togglePlay() {
    if (!videoRef.current || !session.isPresenter) return;

    const currentTime = videoRef.current.currentTime;

    if (isPlaying) {
      videoRef.current.pause();
      emitVideoControl("pause", currentTime);
    } else {
      videoRef.current.play();
      emitVideoControl("play", currentTime);
    }
  }

  function forwardVideo() {
    if (!videoRef.current || !session.isPresenter) return;

    videoRef.current.currentTime += 10;
    emitVideoControl("seek", videoRef.current.currentTime);
  }

  function backwardVideo() {
    if (!videoRef.current || !session.isPresenter) return;

    videoRef.current.currentTime = Math.max(
      0,
      videoRef.current.currentTime - 10
    );
    emitVideoControl("seek", videoRef.current.currentTime);
  }

  function restartVideo() {
    if (!videoRef.current || !session.isPresenter) return;

    videoRef.current.currentTime = 0;
    videoRef.current.play();
    emitVideoControl("play", 0);
  }

  async function analyzeWithEngine() {
    if (!session?.code || engineStatus === "analyzing") return;

    try {
      setEngineStatus("analyzing");

      const res = await fetch(`${API}/sessions/${session.code}/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Analyse IA impossible");
      }

      const updatedSession = await res.json();
      const metadata = parseEngineMetadata(updatedSession);

      setEngineStatus(updatedSession.engineStatus || "ready");
      setEngineMetadata(metadata);
      setSubtitleLang(metadata?.language || "");
      setCurrentSubtitle("");
      onSessionUpdate?.({
        ...session,
        ...updatedSession,
        videoUrl: session.videoUrl,
        currentUserName: session.currentUserName,
        isPresenter: session.isPresenter,
      });
    } catch (error) {
      setEngineStatus("failed");
      alert(error.message);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(session.code);
    alert("Code de session copié !");
  }

  function sendMessage(e) {
    e.preventDefault();

    if (!chatText.trim()) return;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("chat-message", {
      code: session.code,
      username: session.currentUserName,
      message: chatText,
    });

    setChatText("");
  }

  function formatMessage(message) {
    if (typeof message === "string") return message;
    if (message.type === "system") return message.message;

    return `${message.username} : ${message.message}`;
  }

  function textForSegment(segment, lang) {
    if (!segment) return "";
    if (!lang || lang === engineMetadata?.language) return segment.text;

    return segment.translations?.[lang] || segment.text;
  }

  function updateSubtitle() {
    if (!videoRef.current || !engineMetadata?.segments?.length) {
      setCurrentSubtitle("");
      return;
    }

    const currentTime = videoRef.current.currentTime;
    const segment = engineMetadata.segments.find(
      (item) => currentTime >= item.start && currentTime < item.end
    );

    setCurrentSubtitle(showSubtitles ? textForSegment(segment, subtitleLang) : "");
  }

  const availableSubtitleLangs =
    engineMetadata?.available_subtitle_langs || [];

  function handleBack() {
    socket.emit("leave-session", {
      code: session.code,
    });
    onBack();
  }

  return (
    <div className="watch-page">
      <header className="watch-header">
        <button className="back-btn" onClick={handleBack}>
          Retour
        </button>

        <div>
          <h1>{session.title}</h1>
          <p>
            <strong>Code :</strong> {session.code} •{" "}
            <strong>Présentateur :</strong> {session.presenterName}
          </p>
        </div>
      </header>

      <main className="watch-layout">
        <section className="video-panel">
          <div className="video-shell">
            <video
              ref={videoRef}
              controls
              className="video-player"
              src={session.videoUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={updateSubtitle}
            />

            {currentSubtitle && (
              <div className="watch-subtitle">{currentSubtitle}</div>
            )}
          </div>

          {session.isPresenter ? (
            <div className="player-controls">
              <button className="control-btn" onClick={backwardVideo}>
                ⏪
              </button>

              <button className="control-btn" onClick={togglePlay}>
                {isPlaying ? "⏸" : "▶"}
              </button>

              <button className="control-btn" onClick={forwardVideo}>
                ⏩
              </button>

              <button className="control-btn" onClick={restartVideo}>
                ↺
              </button>

              <button className="control-btn" onClick={copyCode}>
                🔗
              </button>
            </div>
          ) : (
            <div className="viewer-notice">
              Vous êtes participant. Seul le présentateur contrôle la vidéo.
            </div>
          )}

          <div className="session-info">
            <h2>Description</h2>
            <p>{session.description || "Aucune description."}</p>
            <small>🎥 {session.videoName}</small>
          </div>

          <div className="session-info ai-panel">
            <div className="ai-panel-header">
              <h2>Analyse IA</h2>
              <button
                onClick={analyzeWithEngine}
                disabled={engineStatus === "analyzing"}
              >
                {engineStatus === "analyzing" ? "Analyse..." : "Analyser avec IA"}
              </button>
            </div>

            {engineStatus === "ready" && engineMetadata ? (
              <>
                <div className="subtitle-controls">
                  <label>Sous-titres</label>
                  <select
                    value={subtitleLang}
                    onChange={(e) => setSubtitleLang(e.target.value)}
                  >
                    {availableSubtitleLangs.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <label className="subtitle-toggle">
                    <input
                      type="checkbox"
                      checked={showSubtitles}
                      onChange={(e) => {
                        setShowSubtitles(e.target.checked);
                        if (!e.target.checked) setCurrentSubtitle("");
                      }}
                    />
                    afficher
                  </label>
                </div>

                <p>{engineMetadata.summary || "Aucun résumé disponible."}</p>

                {engineMetadata.chapters?.length ? (
                  <div className="chapter-list">
                    {engineMetadata.chapters.map((chapter, index) => (
                      <button
                        key={`${chapter.start}-${index}`}
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = chapter.start;
                          }
                        }}
                      >
                        {chapter.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p>
                {engineStatus === "failed"
                  ? "L'analyse a échoué. Vérifiez que l'engine tourne et que le disque a assez d'espace."
                  : "Lancez l'analyse pour générer transcription, traductions et chapitres."}
              </p>
            )}
          </div>
        </section>

        <aside className="watch-sidebar">
          <div className="side-card">
            <h2>👥 Participants ({participants.length})</h2>

            {participants.map((name, index) => (
              <div className="participant" key={index}>
                🟢 <strong>{name}</strong>
                {name === session.presenterName && (
                  <span className="badge-presenter">Présentateur</span>
                )}
              </div>
            ))}
          </div>

          <div className="side-card chat-card">
            <h2>💬 Chat</h2>

            {messages.map((message, index) => (
              <div
                className={`message ${
                  message.type === "system" ? "system-message" : ""
                }`}
                key={message.id || index}
              >
                {formatMessage(message)}
              </div>
            ))}

            <form onSubmit={sendMessage}>
              <input
                type="text"
                placeholder="Écrire un message..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
              />
            </form>
          </div>
        </aside>
      </main>
    </div>
  );
}
