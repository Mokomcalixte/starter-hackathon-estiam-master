import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "../styles/watch.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const SOCKET_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const socket = io(SOCKET_URL);

const DRIFT_THRESHOLD = 2;
const DRIFT_CHECK_INTERVAL = 5000;

function parseEngineMetadata(session) {
  if (!session?.engineMetadata) return null;
  if (typeof session.engineMetadata === "object") return session.engineMetadata;

  try {
    return JSON.parse(session.engineMetadata);
  } catch {
    return null;
  }
}

function normalizeMessage(message) {
  if (typeof message === "string") {
    return {
      id: message,
      type: "system",
      username: "Systeme",
      message,
      text: message,
    };
  }

  return {
    ...message,
    text: message.text ?? message.message,
    message: message.message ?? message.text,
  };
}

export default function WatchRoom({ session, onBack, onSessionUpdate }) {
  const videoRef = useRef(null);
  const isHandlingRemote = useRef(false);
  const expectedTime = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [participants, setParticipants] = useState(() => [
    {
      username: session?.currentUserName || "Vous",
      isPresenter: Boolean(session?.isPresenter),
    },
  ]);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [reactions, setReactions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [engineStatus, setEngineStatus] = useState(
    session?.engineStatus || (parseEngineMetadata(session) ? "ready" : "idle")
  );
  const [engineMetadata, setEngineMetadata] = useState(() =>
    parseEngineMetadata(session)
  );
  const [subtitleLang, setSubtitleLang] = useState("");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState("");

  const applySyncState = useCallback(
    ({ isPlaying, currentTime, playbackRate }) => {
      if (!videoRef.current) return;

      isHandlingRemote.current = true;
      videoRef.current.currentTime = currentTime;
      videoRef.current.playbackRate = playbackRate ?? 1;
      expectedTime.current = currentTime;

      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }

      setIsPlaying(isPlaying);
      setPlaybackRate(playbackRate ?? 1);
      setTimeout(() => {
        isHandlingRemote.current = false;
      }, 300);
    },
    []
  );

  useEffect(() => {
    const metadata = parseEngineMetadata(session);

    setEngineMetadata(metadata);
    setEngineStatus(session?.engineStatus || (metadata ? "ready" : "idle"));
    setSubtitleLang(metadata?.language || "");
  }, [session]);

  useEffect(() => {
    if (!session?.code) return;

    setParticipants([
      {
        username: session.currentUserName || "Vous",
        isPresenter: Boolean(session.isPresenter),
      },
    ]);
    setMessages([]);

    function mergeMessage(nextMessage) {
      const normalized = normalizeMessage(nextMessage);

      setMessages((prev) => {
        if (
          normalized.id &&
          prev.some((message) => message.id === normalized.id)
        ) {
          return prev;
        }

        return [...prev, normalized];
      });
    }

    function joinSession() {
      socket.emit("join-session", {
        code: session.code,
        username: session.currentUserName,
        isPresenter: session.isPresenter,
      });
    }

    function handleParticipantList(data) {
      setParticipants(data.participants || []);
    }

    function handleChatHistory(data) {
      setMessages((data.messages || []).map(normalizeMessage));
    }

    function handleVideoControl(data) {
      if (!videoRef.current || session.isPresenter) return;

      isHandlingRemote.current = true;

      if (data.action === "play") {
        videoRef.current.currentTime = data.time;
        videoRef.current.play().catch(() => {});
        expectedTime.current = data.time;
        setIsPlaying(true);
      }

      if (data.action === "pause") {
        videoRef.current.currentTime = data.time;
        videoRef.current.pause();
        expectedTime.current = data.time;
        setIsPlaying(false);
      }

      if (data.action === "seek") {
        videoRef.current.currentTime = data.time;
        expectedTime.current = data.time;
      }

      if (data.action === "rate" && data.rate) {
        videoRef.current.playbackRate = data.rate;
        setPlaybackRate(data.rate);
      }

      setTimeout(() => {
        isHandlingRemote.current = false;
      }, 300);
    }

    function handleChatMessage(data) {
      mergeMessage(data);
    }

    function handleReaction(data) {
      const id = `${Date.now()}-${Math.random()}`;
      setReactions((prev) => [...prev, { id, ...data }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((reaction) => reaction.id !== id));
      }, 3000);
    }

    socket.on("connect", joinSession);
    socket.on("sync-state", applySyncState);
    socket.on("participant-list", handleParticipantList);
    socket.on("chat-history", handleChatHistory);
    socket.on("video-control", handleVideoControl);
    socket.on("chat-message", handleChatMessage);
    socket.on("reaction", handleReaction);

    if (socket.connected) {
      joinSession();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", joinSession);
      socket.off("sync-state", applySyncState);
      socket.off("participant-list", handleParticipantList);
      socket.off("chat-history", handleChatHistory);
      socket.off("video-control", handleVideoControl);
      socket.off("chat-message", handleChatMessage);
      socket.off("reaction", handleReaction);
    };
  }, [
    session?.code,
    session?.currentUserName,
    session?.isPresenter,
    applySyncState,
  ]);

  useEffect(() => {
    if (!session?.isPresenter) return;

    const interval = setInterval(() => {
      if (!videoRef.current || videoRef.current.paused) return;

      socket.emit("video-control", {
        code: session.code,
        action: "seek",
        time: videoRef.current.currentTime,
      });
    }, DRIFT_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [session?.code, session?.isPresenter]);

  useEffect(() => {
    if (session?.isPresenter) return;

    const interval = setInterval(() => {
      if (!videoRef.current || videoRef.current.paused) return;

      const drift = Math.abs(videoRef.current.currentTime - expectedTime.current);

      if (drift > DRIFT_THRESHOLD) {
        socket.emit("request-sync", { code: session.code });
      }
    }, DRIFT_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [session?.code, session?.isPresenter]);

  if (!session) {
    return (
      <div className="watch-page">
        <button onClick={onBack}>Retour</button>
        <h1>Aucune session sélectionnée</h1>
      </div>
    );
  }

  function emitControl(action, time, extra = {}) {
    if (!session.isPresenter) return;
    socket.emit("video-control", { code: session.code, action, time, ...extra });
  }

  function togglePlay() {
    if (!videoRef.current || !session.isPresenter) return;

    const time = videoRef.current.currentTime;

    if (isPlaying) {
      videoRef.current.pause();
      emitControl("pause", time);
    } else {
      videoRef.current.play().catch(() => {});
      emitControl("play", time);
    }
  }

  function forward() {
    if (!videoRef.current || !session.isPresenter) return;
    videoRef.current.currentTime += 10;
    emitControl("seek", videoRef.current.currentTime);
  }

  function backward() {
    if (!videoRef.current || !session.isPresenter) return;
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    emitControl("seek", videoRef.current.currentTime);
  }

  function restart() {
    if (!videoRef.current || !session.isPresenter) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(() => {});
    emitControl("play", 0);
  }

  function changeRate(rate) {
    if (!videoRef.current || !session.isPresenter) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    emitControl("rate", videoRef.current.currentTime, { rate });
  }

  function handleVideoPlay() {
    setIsPlaying(true);

    if (!isHandlingRemote.current && session.isPresenter) {
      emitControl("play", videoRef.current.currentTime);
    }
  }

  function handleVideoPause() {
    setIsPlaying(false);

    if (!isHandlingRemote.current && session.isPresenter) {
      emitControl("pause", videoRef.current.currentTime);
    }
  }

  function handleVideoSeeked() {
    if (!isHandlingRemote.current && session.isPresenter) {
      emitControl("seek", videoRef.current.currentTime);
    }
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

  function sendReaction(emoji) {
    socket.emit("reaction", {
      code: session.code,
      username: session.currentUserName,
      emoji,
    });
  }

  function copyCode() {
    navigator.clipboard.writeText(session.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  function handleBack() {
    socket.emit("leave-session", {
      code: session.code,
    });
    onBack();
  }

  const availableSubtitleLangs =
    engineMetadata?.available_subtitle_langs || [];

  return (
    <div className="watch-page">
      <div className="reactions-overlay">
        {reactions.map((reaction) => (
          <div key={reaction.id} className="reaction-bubble">
            <span>{reaction.emoji}</span>
            <small>{reaction.username}</small>
          </div>
        ))}
      </div>

      <header className="watch-header">
        <button className="back-btn" onClick={handleBack}>
          Retour
        </button>
        <div className="header-info">
          <h1>{session.title}</h1>
          <p>
            <strong>Code :</strong> {session.code} &bull;{" "}
            <strong>Rôle :</strong>{" "}
            {session.isPresenter ? "Présentateur" : "Invité"}
          </p>
        </div>
        <button className="copy-btn" onClick={copyCode}>
          {copied ? "Copié !" : "Copier le code"}
        </button>
      </header>

      <main className="watch-layout">
        <section className="video-panel">
          <div className="video-shell">
            <video
              ref={videoRef}
              controls
              className="video-player"
              src={session.videoUrl}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onSeeked={handleVideoSeeked}
              onTimeUpdate={updateSubtitle}
            />

            {currentSubtitle && (
              <div className="watch-subtitle">{currentSubtitle}</div>
            )}
          </div>

          {session.isPresenter ? (
            <div className="player-controls">
              <button className="control-btn" onClick={backward} title="Reculer 10s">
                ⏪
              </button>
              <button className="control-btn play-btn" onClick={togglePlay}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button className="control-btn" onClick={forward} title="Avancer 10s">
                ⏩
              </button>
              <button className="control-btn" onClick={restart} title="Recommencer">
                ↺
              </button>

              <div className="rate-control">
                {[0.5, 1, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    className={`rate-btn ${playbackRate === rate ? "active" : ""}`}
                    onClick={() => changeRate(rate)}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="viewer-notice">
              Vous êtes invité. Seul le présentateur contrôle la vidéo.
            </div>
          )}

          <div className="emoji-bar">
            {["👍", "❤️", "😂", "😮", "👏", "🔥"].map((emoji) => (
              <button
                key={emoji}
                className="emoji-btn"
                onClick={() => sendReaction(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="session-info">
            <h2>Description</h2>
            <p>{session.description || "Aucune description."}</p>
            <small>{session.videoName}</small>
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
            <h2>Participants ({participants.length})</h2>
            <div className="participant-list">
              {participants.map((participant, index) => (
                <div className="participant" key={`${participant.username}-${index}`}>
                  <span className="dot">●</span>
                  <strong>{participant.username}</strong>
                  {participant.isPresenter && (
                    <span className="badge-presenter">Présentateur</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="side-card chat-card">
            <h2>Chat</h2>
            <div className="messages-list">
              {messages.map((message, index) =>
                message.type === "system" ? (
                  <div
                    key={message.id || index}
                    className="message system-message"
                  >
                    {message.text || message.message}
                  </div>
                ) : (
                  <div key={message.id || index} className="message">
                    <span className="msg-author">{message.username}</span>
                    <span className="msg-text">{message.text || message.message}</span>
                  </div>
                )
              )}
            </div>
            <form className="chat-form" onSubmit={sendMessage}>
              <input
                type="text"
                placeholder="Écrire un message..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
              />
              <button type="submit">➤</button>
            </form>
          </div>
        </aside>
      </main>
    </div>
  );
}
