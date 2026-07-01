import { useState } from "react";

export default function CreateSession({ onCancel, onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!title || !videoFile) {
      alert("Ajoute un titre et une vidéo.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("video", videoFile);

      const res = await fetch("http://localhost:3000/sessions", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Erreur lors de la création de la session");
      }

      const savedSession = await res.json();

      onCreate({
        ...savedSession,
        videoUrl: `http://localhost:3000/uploads/${savedSession.videoPath}`,
        presenter: "Vous",
        participants: ["Vous"],
      });
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="create-page">
      <form className="create-card" onSubmit={handleSubmit}>
        <button type="button" className="back-btn" onClick={onCancel}>
          Retour
        </button>

        <span className="badge">Nouvelle session</span>
        <h1>Créer une session Watch Together</h1>
        <p>Importez une vidéo et invitez vos participants à la regarder en synchronisé.</p>

        <label>Nom de la session</label>
        <input
          placeholder="Ex : Présentation projet hackathon"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label>Description</label>
        <textarea
          placeholder="Petite description de la session..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label>Importer une vidéo</label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setVideoFile(e.target.files[0])}
        />

        {videoFile && <p className="file-name">🎥 {videoFile.name}</p>}

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Création..." : "Créer la session"}
        </button>
      </form>
    </div>
  );
}