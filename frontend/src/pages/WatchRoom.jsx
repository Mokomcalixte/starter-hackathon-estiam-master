import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import "../styles/watch.css";

// Socket unique partagé
const socket = io("http://localhost:3000");

// Seuil de dérive en secondes — au-delà, on resynchronise
const DRIFT_THRESHOLD = 2;
// Intervalle de vérification de dérive (ms)
const DRIFT_CHECK_INTERVAL = 5000;

export default function WatchRoom({ session, onBack }) {
  const videoRef = useRef(null);
  const isHandlingRemote = useRef(false); // ★ Anti-écho
  const expectedTime = useRef(0);         // ★ Anti-dérive

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [participants, setParticipants] = useState([
    { username: session?.currentUserName || "Vous", isPresenter: session?.isPresenter },
  ]);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [reactions, setReactions] = useState([]);
  const [copied, setCopied] = useState(false);

  // ── Appliquer un état de sync ──────────────────────────────
  const applySyncState = useCallback(({ isPlaying, currentTime, playbackRate }) => {
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

    setTimeout(() => { isHandlingRemote.current = false; }, 300);
  }, []);

  // ── Socket listeners ───────────────────────────────────────
  useEffect(() => {
    if (!session?.code) return;

    socket.emit("join-session", {
      code: session.code,
      username: session.currentUserName,
      isPresenter: session.isPresenter,
    });

    // Resynchronisation à l'arrivée ou sur demande
    socket.on("sync-state", applySyncState);

    // Contrôle vidéo reçu (invités seulement — le présentateur n'en a pas besoin)
    socket.on("video-control", (data) => {
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

      setTimeout(() => { isHandlingRemote.current = false; }, 300);
    });

    socket.on("participant-joined", (data) => {
      setParticipants((prev) => {
        if (prev.find((p) => p.username === data.username)) return prev;
        return [...prev, data];
      });
      setMessages((prev) => [...prev, {
        type: "system",
        text: `🟢 ${data.username} a rejoint la salle`,
      }]);
    });

    socket.on("participant-left", (data) => {
      setParticipants((prev) => prev.filter((p) => p.username !== data.username));
      setMessages((prev) => [...prev, {
        type: "system",
        text: `🔴 ${data.username} a quitté la salle`,
      }]);
    });

    socket.on("chat-message", (data) => {
      setMessages((prev) => [...prev, {
        type: "chat",
        username: data.username,
        text: data.message,
        timestamp: data.timestamp,
      }]);
    });

    // Réactions emoji
    socket.on("reaction", (data) => {
      const id = Date.now();
      setReactions((prev) => [...prev, { id, emoji: data.emoji, username: data.username }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3000);
    });

    return () => {
      socket.off("sync-state");
      socket.off("video-control");
      socket.off("participant-joined");
      socket.off("participant-left");
      socket.off("chat-message");
      socket.off("reaction");
    };
  }, [session?.code, session?.currentUserName, session?.isPresenter, applySyncState]);

  // ── Anti-dérive : vérification toutes les 5s ───────────────
  useEffect(() => {
    if (!session?.isPresenter) return; // Seul le présentateur émet la correction

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

  // ── Vérification dérive côté invité ───────────────────────
  useEffect(() => {
    if (session?.isPresenter) return;

    const interval = setInterval(() => {
      if (!videoRef.current || videoRef.current.paused) return;
      const drift = Math.abs(videoRef.current.currentTime - expectedTime.current);
      if (drift > DRIFT_THRESHOLD) {
        // Trop de dérive → demander une resync
        socket.emit("request-sync", { code: session.code });
      }
    }, DRIFT_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [session?.code, session?.isPresenter]);

  // ── Émettre un contrôle (présentateur) ────────────────────
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
      videoRef.current.play();
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
    videoRef.current.play();
    emitControl("play", 0);
  }

  function changeRate(rate) {
    if (!videoRef.current || !session.isPresenter) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    emitControl("rate", videoRef.current.currentTime, { rate });
  }

  // ── Gestion events vidéo natifs ────────────────────────────
  // ★ Anti-écho : si l'action vient d'un message Socket, on ne ré-émet pas
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

  // ── Chat ──────────────────────────────────────────────────
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

  // ── Réactions ─────────────────────────────────────────────
  function sendReaction(emoji) {
    socket.emit("reaction", {
      code: session.code,
      username: session.currentUserName,
      emoji,
    });
  }

  // ── Copier code ───────────────────────────────────────────
  function copyCode() {
    navigator.clipboard.writeText(session.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!session) {
    return (
      <div className="watch-page">
        <button onClick={onBack}>← Retour</button>
        <h1>Aucune session sélectionnée</h1>
      </div>
    );
  }

  return (
    <div className="watch-page">
      {/* Réactions flottantes */}
      <div className="reactions-overlay">
        {reactions.map((r) => (
          <div key={r.id} className="reaction-bubble">
            <span>{r.emoji}</span>
            <small>{r.username}</small>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="watch-header">
        <button className="back-btn" onClick={onBack}>← Retour</button>
        <div className="header-info">
          <h1>{session.title}</h1>
          <p>
            <strong>Code :</strong> {session.code} &bull;{" "}
            <strong>Rôle :</strong>{" "}
            {session.isPresenter ? "🎬 Présentateur" : "👁 Invité"}
          </p>
        </div>
        <button className="copy-btn" onClick={copyCode}>
          {copied ? "✅ Copié !" : "🔗 Copier le code"}
        </button>
      </header>

      <main className="watch-layout">
        {/* Vidéo */}
        <section className="video-panel">
          <video
            ref={videoRef}
            className="video-player"
            src={session.videoUrl}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onSeeked={handleVideoSeeked}
          />

          {session.isPresenter ? (
            <div className="player-controls">
              <button className="control-btn" onClick={backward} title="Reculer 10s">⏪</button>
              <button className="control-btn play-btn" onClick={togglePlay}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button className="control-btn" onClick={forward} title="Avancer 10s">⏩</button>
              <button className="control-btn" onClick={restart} title="Recommencer">↺</button>

              {/* Vitesse de lecture */}
              <div className="rate-control">
                {[0.5, 1, 1.5, 2].map((r) => (
                  <button
                    key={r}
                    className={`rate-btn ${playbackRate === r ? "active" : ""}`}
                    onClick={() => changeRate(r)}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="viewer-notice">
              👁 Vous êtes invité — seul le présentateur contrôle la vidéo
            </div>
          )}

          {/* Réactions */}
          <div className="emoji-bar">
            {["👍", "❤️", "😂", "😮", "👏", "🔥"].map((e) => (
              <button key={e} className="emoji-btn" onClick={() => sendReaction(e)}>
                {e}
              </button>
            ))}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="watch-sidebar">
          {/* Participants */}
          <div className="side-card">
            <h2>👥 Participants ({participants.length})</h2>
            <div className="participant-list">
              {participants.map((p, i) => (
                <div className="participant" key={i}>
                  <span className="dot">🟢</span>
                  <strong>{p.username}</strong>
                  {p.isPresenter && <span className="badge-presenter">Présentateur</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="side-card chat-card">
            <h2>💬 Chat</h2>
            <div className="messages-list">
              {messages.map((msg, i) =>
                msg.type === "system" ? (
                  <div key={i} className="message system-message">{msg.text}</div>
                ) : (
                  <div key={i} className="message">
                    <span className="msg-author">{msg.username}</span>
                    <span className="msg-text">{msg.text}</span>
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