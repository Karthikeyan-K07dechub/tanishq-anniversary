import { useEffect, useRef, useState } from "react";
import "@fontsource/italiana";
import "@fontsource/italianno";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import landingBackground from "../landing-page-image-2.png";
import mobileVideoContainerBackground from "../mobile-page-container-bc-image-2.png";
import mobileVideoFrameOverlay from "../mobile-page-container-bc-image-3.png";
import mobileContainerBackground from "../mobile-page-container-bc-image.png";
import mobilePageBackground from "../mobile-page-bc-image.png";
import qrBackground from "../qr-page-image.png";
import qrImage from "../qr.png";

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

  return (
    <ScreenPage background={mobilePageBackground} className="mobile-home-page">
      <div className="mobile-shell">
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
                />
              </label>

              <label className="mobile-field mobile-field-message">
                <span className="mobile-field-label">Personalised message :</span>
                <textarea
                  className="mobile-field-input mobile-field-textarea"
                  name="message"
                  placeholder="Write your message"
                  rows="3"
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
  const liveVideoRef = useRef(null);
  const playbackVideoRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const [recordingState, setRecordingState] = useState("idle");
  const [previewMode, setPreviewMode] = useState("idle");
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [statusMessage, setStatusMessage] = useState(
    "Tap record to allow camera and microphone access."
  );

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
      setStatusMessage("This browser does not support in-browser video recording.");
      return;
    }

    if (recordingState === "recording" && recorderRef.current) {
      recorderRef.current.stop();
      setRecordingState("processing");
      setStatusMessage("Finishing your video...");
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
        setStatusMessage("Recording complete. Use Preview or Submit.");
      });

      recorder.start();
      setRecordingState("recording");
      setStatusMessage("Recording in progress. Tap again to stop.");
    } catch (error) {
      setStatusMessage(
        "Camera or microphone permission was denied, or the device is unavailable."
      );
    }
  }

  async function handlePreviewClick() {
    if (!recordedUrl) {
      setStatusMessage("Record a video first to preview it.");
      return;
    }

    setPreviewMode("recorded");
    setStatusMessage("Previewing your recorded video.");

    if (playbackVideoRef.current) {
      playbackVideoRef.current.currentTime = 0;
      await playbackVideoRef.current.play().catch(() => {});
    }
  }

  async function handleSubmitClick() {
    if (!recordedBlob || !recordedUrl) {
      setStatusMessage("Record a video first before submitting.");
      return;
    }

    const extension = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
    const fileName = `tanishq-video-${Date.now()}.${extension}`;

    if (navigator.canShare && navigator.share) {
      try {
        const file = new File([recordedBlob], fileName, {
          type: recordedBlob.type || "video/webm",
        });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Tanishq Anniversary Video",
            text: "My Tanishq 30 years greeting video",
          });
          setStatusMessage("Video shared successfully.");
          return;
        }
      } catch (error) {
        setStatusMessage("Share was cancelled. Downloading the video instead.");
      }
    }

    const anchor = document.createElement("a");
    anchor.href = recordedUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setStatusMessage("Video downloaded successfully.");
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
            >
              {recordingState === "recording" ? "Stop recording" : "Record your video"}
            </button>
            <p className="mobile-video-status">{statusMessage}</p>
          </div>
        </section>

        <div className="mobile-video-footer-actions">
          <button
            type="button"
            className="mobile-video-small-button"
            onClick={handlePreviewClick}
          >
            Preview
          </button>
          <button
            type="button"
            className="mobile-video-small-button mobile-video-small-button-edit"
            onClick={handleSubmitClick}
          >
            Submit
          </button>
        </div>
      </div>
    </ScreenPage>
  );
}

function MobilePhotoPage() {
  return (
    <ScreenPage background={mobilePageBackground} className="mobile-photo-page">
      <div className="mobile-shell">
        <h1 className="mobile-video-title">
          Click my photo for Tanishq
          <br />
          30 years
        </h1>

        <section className="mobile-video-card">
          <img
            className="mobile-video-card-background"
            src={mobileVideoContainerBackground}
            alt=""
            aria-hidden="true"
          />

          <div className="mobile-video-card-content">
            <button type="button" className="mobile-video-record-button">
              Click image
            </button>
          </div>
        </section>

        <div className="mobile-video-footer-actions">
          <button type="button" className="mobile-video-small-button">
            Preview
          </button>
          <button type="button" className="mobile-video-small-button mobile-video-small-button-edit">
            Submit
          </button>
        </div>
      </div>
    </ScreenPage>
  );
}

function MobileMessagePage() {
  return (
    <ScreenPage background={mobilePageBackground} className="mobile-message-page">
      <div className="mobile-shell">
        <h1 className="mobile-video-title">
          Write my wishes to Tanishq
          <br />
          for 30 years
        </h1>

        <section className="mobile-video-card">
          <img
            className="mobile-video-card-background"
            src={mobileVideoContainerBackground}
            alt=""
            aria-hidden="true"
          />

          <div className="mobile-video-card-content">
            <button type="button" className="mobile-video-record-button">
              Write message
            </button>
          </div>
        </section>

        <div className="mobile-video-footer-actions">
          <button type="button" className="mobile-video-small-button">
            Preview
          </button>
          <button type="button" className="mobile-video-small-button mobile-video-small-button-edit">
            Submit
          </button>
        </div>
      </div>
    </ScreenPage>
  );
}

export default function App() {
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
