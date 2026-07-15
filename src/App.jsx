import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import "@fontsource/italiana";
import "@fontsource/italianno";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import landingBackground from "../landing-page-image-2.png";
import mobileVideoFrameOverlay from "../mobile-page-container-bc-image-3.png";
import mobileContainerBackground from "../mobile-page-container-bc-image.png";
import mobilePageBackground from "../mobile-page-bc-image.png";
import qrBackground from "../qr-page-image.png";
import qrImage from "../qr.png";

const MOBILE_DRAFT_STORAGE_KEY = "tanishq-mobile-draft";

const SubmissionContext = createContext(null);

function readStoredDraft() {
  if (typeof window === "undefined") {
    return { guestName: "", personalizedMessage: "" };
  }

  try {
    const storedDraft = window.localStorage.getItem(MOBILE_DRAFT_STORAGE_KEY);
    if (!storedDraft) {
      return { guestName: "", personalizedMessage: "" };
    }

    const parsedDraft = JSON.parse(storedDraft);

    return {
      guestName: parsedDraft.guestName || "",
      personalizedMessage: parsedDraft.personalizedMessage || "",
    };
  } catch {
    return { guestName: "", personalizedMessage: "" };
  }
}

function SubmissionProvider({ children }) {
  const [draft, setDraft] = useState(() => readStoredDraft());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(MOBILE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  return (
    <SubmissionContext.Provider value={{ draft, setDraft }}>
      {children}
    </SubmissionContext.Provider>
  );
}

function useSubmissionDraft() {
  const context = useContext(SubmissionContext);

  if (!context) {
    throw new Error("useSubmissionDraft must be used inside SubmissionProvider.");
  }

  return context;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file payload."));
    reader.readAsDataURL(blob);
  });
}

async function submitSubmission(payload) {
  const response = await fetch("/api/submissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.error || "Unable to submit this greeting.");
  }

  return response.json();
}

function ScreenPage({ className = "", children, background }) {
  const classes = ["screen-page", className].filter(Boolean).join(" ");

  return (
    <main
      className={classes}
      style={{ backgroundImage: `url(${background})` }}
    >
      <section className="screen-overlay">{children}</section>
    </main>
  );
}

function LandingPage() {
  const navigate = useNavigate();

  return (
    <ScreenPage background={landingBackground} className="landing-page">
      <button
        type="button"
        className="cta-button"
        onClick={() => navigate("/qr")}
      >
        Create your personal greeting
      </button>
    </ScreenPage>
  );
}

function QrPage() {
  return (
    <ScreenPage background={qrBackground} className="qr-page">
      <h1 className="qr-heading">
        Write / Click / Record your Wishes for Tanishq&apos;s 30th birthday
      </h1>
      <img className="qr-code" src={qrImage} alt="QR code for Tanishq wishes" />
      <p className="qr-caption">Scan the QR</p>
    </ScreenPage>
  );
}

function MobileHomePage() {
  const navigate = useNavigate();
  const { draft, setDraft } = useSubmissionDraft();

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  return (
    <ScreenPage background={mobilePageBackground} className="mobile-home-page">
      <div className="mobile-shell mobile-shell-home">
        <h1 className="mobile-home-title">
          Write my wishes to Tanishq
          <br />
          for 30 years
        </h1>

        <section className="mobile-card">
          <img
            className="mobile-card-background"
            src={mobileContainerBackground}
            alt=""
            aria-hidden="true"
          />

          <div className="mobile-card-content">
            <div className="mobile-form">
              <label className="mobile-field">
                <span className="mobile-field-label">Name :</span>
                <input
                  className="mobile-field-input"
                  type="text"
                  name="guestName"
                  placeholder="Enter your name"
                  value={draft.guestName}
                  onChange={(event) => updateDraft("guestName", event.target.value)}
                />
              </label>

              <label className="mobile-field mobile-field-message">
                <span className="mobile-field-label">Personalised message :</span>
                <textarea
                  className="mobile-field-input mobile-field-textarea"
                  name="message"
                  placeholder="Write your message"
                  rows="3"
                  value={draft.personalizedMessage}
                  onChange={(event) =>
                    updateDraft("personalizedMessage", event.target.value)
                  }
                />
              </label>
            </div>

            <div className="mobile-actions">
              <button
                type="button"
                className="mobile-action-button"
                onClick={() => navigate("/mobile/message")}
              >
                Write my wishes to Tanishq for 30 years
              </button>
              <button
                type="button"
                className="mobile-action-button"
                onClick={() => navigate("/mobile/photo")}
              >
                Click my photo for Tanishq 30 years
              </button>
              <button
                type="button"
                className="mobile-action-button"
                onClick={() => navigate("/mobile/video")}
              >
                Record my wish for Tanishq 30 years
              </button>
            </div>
          </div>
        </section>
      </div>
    </ScreenPage>
  );
}

function MobileVideoPage() {
  const { draft } = useSubmissionDraft();
  const liveVideoRef = useRef(null);
  const playbackVideoRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const [recordingState, setRecordingState] = useState("idle");
  const [previewMode, setPreviewMode] = useState("idle");
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [recordedUrl]);

  async function ensureStream() {
    if (streamRef.current) {
      return streamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 1280 },
      },
      audio: true,
    });

    streamRef.current = stream;

    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = stream;
      await liveVideoRef.current.play().catch(() => {});
    }

    return stream;
  }

  function getRecordingMimeType() {
    const preferredTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];

    return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  async function handleRecordClick() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      return;
    }

    if (recordingState === "recording" && recorderRef.current) {
      recorderRef.current.stop();
      setRecordingState("processing");
      return;
    }

    try {
      const stream = await ensureStream();
      const mimeType = getRecordingMimeType();

      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
        setRecordedUrl("");
      }

      setRecordedBlob(null);
      setPreviewMode("live");
      chunksRef.current = [];

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        const nextUrl = URL.createObjectURL(blob);

        setRecordedBlob(blob);
        setRecordedUrl(nextUrl);
        setPreviewMode("recorded");
        setRecordingState("ready");
      });

      recorder.start();
      setRecordingState("recording");
    } catch {
      setRecordingState("idle");
    }
  }

  async function handlePreviewClick() {
    if (!recordedUrl) {
      return;
    }

    setPreviewMode("recorded");

    if (playbackVideoRef.current) {
      playbackVideoRef.current.currentTime = 0;
      await playbackVideoRef.current.play().catch(() => {});
    }
  }

  async function handleSubmitClick() {
    if (!recordedBlob || !recordedUrl || isSubmitting) {
      return;
    }

    const extension = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
    const fileName = `tanishq-video-${Date.now()}.${extension}`;

    setIsSubmitting(true);

    try {
      const dataUrl = await blobToDataUrl(recordedBlob);

      await submitSubmission({
        name: draft.guestName.trim(),
        landingMessage: draft.personalizedMessage.trim(),
        pageType: "video",
        pagePayload: {
          video: {
            fileName,
            mimeType: recordedBlob.type || "video/webm",
            dataUrl,
          },
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenPage background={mobilePageBackground} className="mobile-video-page">
      <div className="mobile-shell">
        <h1 className="mobile-video-title">
          Record my video for Tanishq
          <br />
          30 years
        </h1>

        <section className="mobile-video-card">
          <div className="mobile-video-card-content">
            <div className="mobile-video-preview-shell">
              <video
                ref={liveVideoRef}
                className={`mobile-video-preview ${previewMode === "recorded" ? "mobile-video-preview-hidden" : ""}`}
                autoPlay
                muted
                playsInline
              />
              <video
                ref={playbackVideoRef}
                className={`mobile-video-preview ${previewMode === "recorded" ? "" : "mobile-video-preview-hidden"}`}
                src={recordedUrl || undefined}
                controls
                playsInline
              />
              {previewMode === "idle" ? (
                <div className="mobile-video-placeholder">
                  Camera preview will appear here
                </div>
              ) : null}
            </div>
            <img
              className="mobile-video-card-overlay"
              src={mobileVideoFrameOverlay}
              alt=""
              aria-hidden="true"
            />

            <button
              type="button"
              className="mobile-video-record-button"
              onClick={handleRecordClick}
              disabled={isSubmitting}
            >
              {recordingState === "recording" ? "Stop recording" : "Record your video"}
            </button>
          </div>
        </section>

        <div className="mobile-video-footer-actions">
          <button
            type="button"
            className="mobile-video-small-button"
            onClick={handlePreviewClick}
            disabled={isSubmitting}
          >
            Preview
          </button>
          <button
            type="button"
            className="mobile-video-small-button mobile-video-small-button-edit"
            onClick={handleSubmitClick}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Submit"}
          </button>
        </div>
      </div>
    </ScreenPage>
  );
}

function MobilePhotoPage() {
  const { draft } = useSubmissionDraft();
  const liveVideoRef = useRef(null);
  const streamRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoMode, setPhotoMode] = useState("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [photoUrl]);

  async function ensurePhotoStream() {
    if (streamRef.current) {
      return streamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 1280 },
      },
      audio: false,
    });

    streamRef.current = stream;

    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = stream;
      await liveVideoRef.current.play().catch(() => {});
    }

    return stream;
  }

  function stopPhotoStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  }

  async function handlePhotoClick() {
    if (!navigator.mediaDevices?.getUserMedia || isSubmitting) {
      return;
    }

    if (photoMode !== "live") {
      await ensurePhotoStream();
      setPhotoMode("live");
      return;
    }

    if (!liveVideoRef.current) {
      return;
    }

    const video = liveVideoRef.current;
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 1280;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      return;
    }

    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }

    const nextFile = new File([blob], `tanishq-photo-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    const nextUrl = URL.createObjectURL(nextFile);
    setPhotoFile(nextFile);
    setPhotoUrl(nextUrl);
    setPhotoMode("captured");
    stopPhotoStream();
  }

  async function handlePhotoSubmit() {
    if (!photoFile || !photoUrl || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const dataUrl = await blobToDataUrl(photoFile);

      await submitSubmission({
        name: draft.guestName.trim(),
        landingMessage: draft.personalizedMessage.trim(),
        pageType: "photo",
        pagePayload: {
          photo: {
            fileName: photoFile.name,
            mimeType: photoFile.type || "image/jpeg",
            dataUrl,
          },
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenPage background={mobilePageBackground} className="mobile-photo-page">
      <div className="mobile-shell">
        <h1 className="mobile-video-title">
          Click my photo for Tanishq
          <br />
          30 years
        </h1>

        <section className="mobile-video-card">
          <div className="mobile-video-card-content">
            <div className="mobile-video-preview-shell mobile-photo-preview-shell">
              <video
                ref={liveVideoRef}
                className={`mobile-video-preview ${photoMode === "live" ? "" : "mobile-video-preview-hidden"}`}
                autoPlay
                muted
                playsInline
              />
              {photoMode === "captured" && photoUrl ? (
                <img
                  className="mobile-video-preview mobile-photo-preview"
                  src={photoUrl}
                  alt="Captured Tanishq greeting"
                />
              ) : photoMode === "idle" ? (
                <div className="mobile-video-placeholder">
                  Camera photo preview will appear here
                </div>
              ) : null}
            </div>
            <img
              className="mobile-video-card-overlay"
              src={mobileVideoFrameOverlay}
              alt=""
              aria-hidden="true"
            />
            <button
              type="button"
              className="mobile-video-record-button"
              onClick={handlePhotoClick}
              disabled={isSubmitting}
            >
              {photoMode === "live" ? "Capture image" : "Click image"}
            </button>
          </div>
        </section>

        <div className="mobile-video-footer-actions">
          <button
            type="button"
            className="mobile-video-small-button"
            onClick={() => {
              if (photoUrl) {
                setPhotoMode("captured");
              }
            }}
            disabled={isSubmitting}
          >
            Preview
          </button>
          <button
            type="button"
            className="mobile-video-small-button mobile-video-small-button-edit"
            onClick={handlePhotoSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Submit"}
          </button>
        </div>
      </div>
    </ScreenPage>
  );
}

function MobileMessagePage() {
  const { draft } = useSubmissionDraft();
  const [messageText, setMessageText] = useState("");
  const [messagePreview, setMessagePreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleMessageSubmit() {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await submitSubmission({
        name: draft.guestName.trim(),
        landingMessage: draft.personalizedMessage.trim(),
        pageType: "message",
        pagePayload: {
          wishText: trimmedMessage,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenPage background={mobilePageBackground} className="mobile-message-page">
      <div className="mobile-shell">
        <h1 className="mobile-video-title">
          Write my wishes to Tanishq
          <br />
          for 30 years
        </h1>

        <section className="mobile-video-card">
          <div className="mobile-video-card-content">
            <div className="mobile-video-preview-shell mobile-message-preview-shell">
              {messagePreview ? (
                <div className="mobile-message-preview-text">
                  {messageText.trim() || "Your message preview will appear here"}
                </div>
              ) : (
                <textarea
                  className="mobile-message-input"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Write your wishes for Tanishq here"
                  rows="10"
                />
              )}
            </div>
            <img
              className="mobile-video-card-overlay"
              src={mobileVideoFrameOverlay}
              alt=""
              aria-hidden="true"
            />
            <button
              type="button"
              className="mobile-video-record-button"
              onClick={() => setMessagePreview(false)}
              disabled={isSubmitting}
            >
              Write message
            </button>
          </div>
        </section>

        <div className="mobile-video-footer-actions">
          <button
            type="button"
            className="mobile-video-small-button"
            onClick={() => setMessagePreview(true)}
            disabled={isSubmitting}
          >
            Preview
          </button>
          <button
            type="button"
            className="mobile-video-small-button mobile-video-small-button-edit"
            onClick={handleMessageSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Submit"}
          </button>
        </div>
      </div>
    </ScreenPage>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/qr" element={<QrPage />} />
      <Route path="/mobile" element={<MobileHomePage />} />
      <Route path="/mobile/message" element={<MobileMessagePage />} />
      <Route path="/mobile/photo" element={<MobilePhotoPage />} />
      <Route path="/mobile/video" element={<MobileVideoPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <SubmissionProvider>
      <AppRoutes />
    </SubmissionProvider>
  );
}
