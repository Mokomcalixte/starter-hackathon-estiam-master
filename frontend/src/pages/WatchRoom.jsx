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
      username: "Système",
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

function engineErrorMessage(payload) {
  if (!payload) return "Analyse IA impossible";
  if (typeof payload === "string") return payload;

  const detail =
    payload?.detail ||
    payload?.payload?.detail ||
    payload?.message?.payload?.detail ||
    payload?.response?.payload?.detail;

  if (typeof detail === "string") return detail;

  const response = payload.message || payload.error || payload;
  if (typeof response === "string") return response;

  const nestedMessage =
    response?.payload?.detail ||
    response?.detail ||
    response?.message?.payload?.detail ||
    response?.message ||
    response?.payload?.message ||
    response?.cause;

  if (typeof nestedMessage === "string") return nestedMessage;

  return JSON.stringify(response);
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
  const [sessionStatus, setSessionStatus] = useState(
    session?.status || "created"
  );
  const [engineStatus, setEngineStatus] = useState(
    session?.engineStatus || (parseEngineMetadata(session) ? "ready" : "idle")
  );
  const [engineMetadata, setEngineMetadata] = useState(() =>
    parseEngineMetadata(session)
  );
  const [engineError, setEngineError] = useState("");
  const [subtitleLang, setSubtitleLang] = useState("");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [isVideoShielded, setIsVideoShielded] = useState(false);

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
    setEngineError("");
    setSubtitleLang(metadata?.language || "");
    setSessionStatus(session?.status || "created");
  }, [session]);

  useEffect(() => {
    let shieldTimer;

    const shieldVideo = () => {
      setIsVideoShielded(true);
      clearTimeout(shieldTimer);
      shieldTimer = setTimeout(() => setIsVideoShielded(false), 1500);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsVideoShielded(true);
      } else {
        shieldVideo();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "PrintScreen") {
        shieldVideo();
      }
    };

    window.addEventListener("blur", shieldVideo);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(shieldTimer);
      window.removeEventListener("blur", shieldVideo);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!session?.code || !session?.isPresenter || session.status === "ended") {
      return;
    }

    async function startSession() {
      try {
        const res = await fetch(`${API}/sessions/${session.code}/start`, {
          method: "POST",
        });

        if (!res.ok) return;

        const updatedSession = await res.json();
        setSessionStatus(updatedSession.status || "active");
        onSessionUpdate?.({
          ...session,
          ...updatedSession,
          videoUrl: session.videoUrl,
          currentUserName: session.currentUserName,
          isPresenter: session.isPresenter,
        });
      } catch {
        setSessionStatus(session.status || "created");
      }
    }

    startSession();
  }, [session?.code, session?.isPresenter]);

  useEffect(() => {
    if (!session?.code || engineStatus !== "analyzing") return;

    let cancelled = false;

    async function refreshAnalysisStatus() {
      try {
        const res = await fetch(`${API}/sessions/${session.code}`);
        if (!res.ok) return;

        const updatedSession = await res.json();
        if (cancelled) return;

        const metadata = parseEngineMetadata(updatedSession);
        setEngineStatus(updatedSession.engineStatus || (metadata ? "ready" : "idle"));
        setEngineMetadata(metadata);
        setEngineError(updatedSession.engineError || "");

        if (metadata) {
          setSubtitleLang(metadata.language || "");
          setCurrentSubtitle("");
        }

        onSessionUpdate?.({
          ...session,
          ...updatedSession,
          videoUrl: session.videoUrl,
          currentUserName: session.currentUserName,
          isPresenter: session.isPresenter,
        });
      } catch {
        // The next interval will retry while the analysis is still pending.
      }
    }

    refreshAnalysisStatus();
    const interval = setInterval(refreshAnalysisStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [engineStatus, session?.code]);

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

    function handleSessionEnded() {
      setSessionStatus("ended");
      socket.emit("leave-session", {
        code: session.code,
      });
      onBack();
    }

    socket.on("connect", joinSession);
    socket.on("sync-state", applySyncState);
    socket.on("participant-list", handleParticipantList);
    socket.on("chat-history", handleChatHistory);
    socket.on("video-control", handleVideoControl);
    socket.on("chat-message", handleChatMessage);
    socket.on("reaction", handleReaction);
    socket.on("session-ended", handleSessionEnded);

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
      socket.off("session-ended", handleSessionEnded);
    };
  }, [
    session?.code,
    session?.currentUserName,
    session?.isPresenter,
    applySyncState,
    onBack,
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
    if (!session.isPresenter || sessionStatus === "ended") return;
    socket.emit("video-control", { code: session.code, action, time, ...extra });
  }

  function togglePlay() {
    if (!videoRef.current || !session.isPresenter || sessionStatus === "ended") {
      return;
    }

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
    if (!videoRef.current || !session.isPresenter || sessionStatus === "ended") {
      return;
    }
    videoRef.current.currentTime += 10;
    emitControl("seek", videoRef.current.currentTime);
  }

  function backward() {
    if (!videoRef.current || !session.isPresenter || sessionStatus === "ended") {
      return;
    }
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    emitControl("seek", videoRef.current.currentTime);
  }

  function restart() {
    if (!videoRef.current || !session.isPresenter || sessionStatus === "ended") {
      return;
    }
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(() => {});
    emitControl("play", 0);
  }

  function changeRate(rate) {
    if (!videoRef.current || !session.isPresenter || sessionStatus === "ended") {
      return;
    }
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
      setEngineError("");

      const res = await fetch(`${API}/sessions/${session.code}/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
          ? await res.json()
          : await res.text();

        throw new Error(engineErrorMessage(payload));
      }

      const updatedSession = await res.json();
      const metadata = parseEngineMetadata(updatedSession);

      setEngineStatus(updatedSession.engineStatus || (metadata ? "ready" : "analyzing"));
      setEngineMetadata(metadata);
      setEngineError(updatedSession.engineError || "");
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
      setEngineError(error.message);
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

  async function endSession() {
    if (!session?.isPresenter) return;
    if (!window.confirm("Terminer cette session ?")) return;

    try {
      const res = await fetch(`${API}/sessions/${session.code}/end`, {
        method: "POST",
      });

      if (!res.ok) {
        alert("Impossible de terminer la session.");
        return;
      }

      const updatedSession = await res.json();
      setSessionStatus(updatedSession.status || "ended");
      onSessionUpdate?.({
        ...session,
        ...updatedSession,
        videoUrl: session.videoUrl,
        currentUserName: session.currentUserName,
        isPresenter: session.isPresenter,
      });
      socket.emit("session-ended", { code: session.code });
      socket.emit("leave-session", { code: session.code });
      onBack();
    } catch {
      alert("Erreur lors de la fermeture de la session.");
    }
  }

  const availableSubtitleLangs =
    engineMetadata?.available_subtitle_langs || [];
  const statusLabel =
    sessionStatus === "ended"
      ? "Terminée"
      : sessionStatus === "active"
        ? "En cours"
        : "Préparée";

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
            <strong>Code :</strong> {session.code} ·{" "}
            <strong>Rôle :</strong>{" "}
            {session.isPresenter ? "Présentateur" : "Invité"} ·{" "}
            <strong>Statut :</strong> {statusLabel}
          </p>
        </div>
        {session.isPresenter && sessionStatus !== "ended" && (
          <button className="end-session-btn" onClick={endSession}>
            Terminer
          </button>
        )}
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
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              draggable="false"
              className="video-player"
              src={session.videoUrl}
              onContextMenu={(event) => event.preventDefault()}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onSeeked={handleVideoSeeked}
              onTimeUpdate={updateSubtitle}
            />

            <div className="video-watermark" aria-hidden="true">
              {session.currentUserName || "Invite"} · {session.code}
            </div>

            {isVideoShielded && (
              <div className="video-shield">
                <strong>Lecture protégée</strong>
                <span>Revenez sur la fenêtre pour afficher la vidéo.</span>
              </div>
            )}

            {currentSubtitle && (
              <div className="watch-subtitle">{currentSubtitle}</div>
            )}
          </div>

          {session.isPresenter && sessionStatus !== "ended" ? (
            <div className="player-controls">
              <button className="control-btn" onClick={backward} title="Reculer 10s">
                {"\u23EA"}
              </button>
              <button className="control-btn play-btn" onClick={togglePlay}>
                {isPlaying ? "\u23F8" : "\u25B6"}
              </button>
              <button className="control-btn" onClick={forward} title="Avancer 10s">
                {"\u23E9"}
              </button>
              <button className="control-btn" onClick={restart} title="Recommencer">
                {"\u21BA"}
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
          ) : sessionStatus !== "ended" ? (
            <div className="viewer-notice">
              Vous êtes invité. Seul le présentateur contrôle la vidéo.
            </div>
          ) : null}

          {sessionStatus === "ended" && (
            <div className="viewer-notice">
              Cette session est terminée. Vous pouvez revoir la vidéo.
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

                <div className="transcript-panel">
                  <h3>Transcription</h3>
                  <p>
                    {engineMetadata.transcript ||
                      "Aucune transcription disponible pour cette video."}
                  </p>
                </div>

                {engineMetadata.segments?.length ? (
                  <div className="segments-panel">
                    <h3>Segments horodates</h3>
                    <div className="segments-list">
                      {engineMetadata.segments.map((segment, index) => (
                        <button
                          key={`${segment.start}-${index}`}
                          className="segment-btn"
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = segment.start;
                            }
                          }}
                        >
                          <span>{Math.floor(segment.start / 60)}:{String(Math.floor(segment.start % 60)).padStart(2, "0")}</span>
                          <strong>{textForSegment(segment, subtitleLang)}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

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
                  ? engineError || "L'analyse a échoué. Vérifiez que l'engine tourne et que le disque a assez d'espace."
                  : engineStatus === "analyzing"
                    ? "Analyse IA en cours. Vous pouvez continuer à regarder la vidéo."
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
              <button type="submit">{"\u27A4"}</button>
            </form>
          </div>
        </aside>
      </main>
    </div>
  );
}
