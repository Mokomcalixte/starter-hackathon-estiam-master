import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

export default function WatchRoom({ session, onBack }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [participants, setParticipants] = useState(() => {
    const initialParticipants = [
      session?.presenterName,
      session?.currentUserName || "Vous",
    ].filter(Boolean);

    return [...new Set(initialParticipants)];
  });
  const [messages, setMessages] = useState(["👋 Session créée avec succès."]);
  const [chatText, setChatText] = useState("");

  useEffect(() => {
    if (!session?.code) return;

    socket.emit("join-session", {
      code: session.code,
      username: session.currentUserName,
    });

    socket.on("participant-list", (data) => {
      const visibleParticipants = [
        session.presenterName,
        ...(data.participants || []),
      ].filter(Boolean);

      setParticipants([...new Set(visibleParticipants)]);
    });

    socket.on("participant-joined", (data) => {
      setParticipants((prev) => {
        if (prev.includes(data.username)) return prev;
        return [...prev, data.username];
      });
    });

    socket.on("video-control", (data) => {
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
    });

    socket.on("chat-message", (data) => {
      setMessages((prev) => [...prev, `${data.username} : ${data.message}`]);
    });

    return () => {
      socket.emit("leave-session", {
        code: session.code,
      });
      socket.off("participant-list");
      socket.off("participant-joined");
      socket.off("video-control");
      socket.off("chat-message");
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

  function copyCode() {
    navigator.clipboard.writeText(session.code);
    alert("Code de session copié !");
  }

  function sendMessage(e) {
    e.preventDefault();

    if (!chatText.trim()) return;

    socket.emit("chat-message", {
      code: session.code,
      username: session.currentUserName,
      message: chatText,
    });

    setChatText("");
  }

  return (
    <div className="watch-page">
      <header className="watch-header">
        <button className="back-btn" onClick={onBack}>
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
          <video
            ref={videoRef}
            controls
            className="video-player"
            src={session.videoUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

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
              <div className="message" key={index}>
                {message}
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
