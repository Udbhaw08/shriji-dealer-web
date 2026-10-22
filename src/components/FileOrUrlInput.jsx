import { useState, useRef, useEffect } from "react";
import { Icon } from "../ui";

/**
 * FileOrUrlInput
 * Flexible, accessible input allowing admins/owners to either:
 *  1. Upload directly from their device (drag-and-drop or browse folders)
 *  2. Enter an online URL or Google Drive link
 *  3. Pick from quick curated presets
 *
 * Automatically uploads local files to /api/upload and provides immediate visual feedback.
 */
export default function FileOrUrlInput({
  id,
  label,
  value,
  onChange,
  accept = "image/*",
  folder = "webstore-assets",
  fileTypeLabel = "File",
  presets = [],
  helperText = "",
  required = false,
  previewType = "image", // 'image' | 'pdf' | 'video' | 'auto'
}) {
  // Determine initial mode based on current value
  const isUploadedFile = typeof value === "string" && value.startsWith("/uploads/");
  const isPreset = presets.some((p) => p.url === value);
  const isDriveLink = typeof value === "string" && value.includes("drive.google.com");

  const [mode, setMode] = useState("upload"); // 'upload' | 'url' | 'preset'
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadedMeta, setUploadedMeta] = useState(null);

  const fileInputRef = useRef(null);

  // Determine effective preview type
  const effectiveType = (() => {
    if (previewType !== "auto") return previewType;
    if (!value) return "image";
    const lower = value.toLowerCase();
    if (lower.endsWith(".pdf") || lower.includes("circular")) return "pdf";
    if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.includes("video")) return "video";
    return "image";
  })();

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = async (file) => {
    if (!file) return;

    // Check size (50MB max)
    const maxBytes = 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(`File too large (${formatFileSize(file.size)}). Maximum allowed is 50 MB.`);
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadProgress(20);

    try {
      const reader = new FileReader();

      const readPromise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read file from device."));
      });

      reader.readAsDataURL(file);
      const dataUrl = await readPromise;

      setUploadProgress(55);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileType: file.type,
          dataUrl,
          folder,
        }),
      });

      setUploadProgress(85);
      const data = await res.json();

      if (data.ok && data.url) {
        setUploadedMeta({
          filename: data.filename,
          originalName: data.originalName,
          size: data.size,
          fileType: data.fileType,
        });
        setUploadProgress(100);
        onChange(data.url, {
          filename: data.filename,
          originalName: data.originalName,
          size: data.size,
          fileType: data.fileType,
        });
      } else {
        throw new Error(data.error || "File upload failed.");
      }
    } catch (err) {
      console.error("[FileOrUrlInput] Upload failed:", err);
      setUploadError(err.message || "Failed to upload file.");
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 400);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    onChange("", null);
    setUploadedMeta(null);
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="file-or-url-wrapper">
      {/* Top Header Row: Label & Dropdown Mode Selector */}
      <div className="file-input-header">
        <label htmlFor={id} className="file-input-label">
          <span>{label}</span>
          {required && <span className="req-star">*</span>}
        </label>

        {/* Mode Selector Dropdown */}
        <div className="source-mode-select-wrap">
          <span className="source-mode-icon">
            {mode === "upload" ? "📁" : mode === "url" ? "🔗" : "⚡"}
          </span>
          <select
            id={`${id}-source-mode`}
            className="source-mode-select"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            aria-label={`Source mode for ${label}`}
          >
            <option value="upload">📁 Upload from Device (Drag & Drop)</option>
            <option value="url">🔗 Online URL / Drive Link</option>
            {presets && presets.length > 0 && (
              <option value="preset">⚡ Quick Presets</option>
            )}
          </select>
        </div>
      </div>

      {/* Helper / description text if provided */}
      {helperText && <p className="file-input-helper">{helperText}</p>}

      {/* ==============================================================
          MODE 1: UPLOAD FROM DEVICE (DRAG & DROP / BROWSE)
          ============================================================== */}
      {mode === "upload" && (
        <div className="device-upload-container">
          {/* Hidden HTML File Input */}
          <input
            ref={fileInputRef}
            id={id}
            type="file"
            accept={accept}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {/* If a file is attached / present */}
          {value ? (
            <div className="attached-file-card">
              <div className="attached-file-preview">
                {effectiveType === "image" && (
                  <img
                    src={value}
                    alt="Uploaded thumbnail"
                    className="attached-thumb-img"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                {effectiveType === "pdf" && (
                  <div className="attached-doc-badge pdf">
                    <span className="doc-badge-icon">📄</span>
                    <span className="doc-badge-ext">PDF</span>
                  </div>
                )}
                {effectiveType === "video" && (
                  <div className="attached-doc-badge video">
                    <span className="doc-badge-icon">📹</span>
                    <span className="doc-badge-ext">VIDEO</span>
                  </div>
                )}
              </div>

              <div className="attached-file-info">
                <div className="attached-file-status">
                  <span className="status-dot live" />
                  <span className="attached-status-text">
                    {value.startsWith("/uploads/") ? "Saved on Server" : "Selected Asset"}
                  </span>
                  {uploadedMeta?.size && (
                    <span className="attached-size-tag">
                      {formatFileSize(uploadedMeta.size)}
                    </span>
                  )}
                </div>

                <div className="attached-file-url" title={value}>
                  {uploadedMeta?.originalName || value}
                </div>

                <div className="attached-file-actions">
                  <button
                    type="button"
                    className="attached-action-btn replace"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Icon name="upload" size={14} />
                    <span>Change File</span>
                  </button>
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="attached-action-btn view"
                  >
                    <Icon name="arrowsm" size={14} />
                    <span>Open</span>
                  </a>
                  <button
                    type="button"
                    className="attached-action-btn remove"
                    onClick={handleClear}
                    disabled={uploading}
                    title="Remove this file"
                  >
                    <Icon name="close" size={14} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Drag & Drop Area */
            <div
              className={`drag-drop-zone ${isDragging ? "is-dragover" : ""} ${
                uploading ? "is-uploading" : ""
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              {uploading ? (
                <div className="upload-progress-state">
                  <div className="upload-spinner" />
                  <span className="upload-spinner-text">
                    Uploading {fileTypeLabel} to server… ({uploadProgress}%)
                  </span>
                  <div className="upload-progress-bar-wrap">
                    <div
                      className="upload-progress-bar-fill"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="drag-drop-content">
                  <div className="drag-drop-icon-circle">
                    <Icon name="upload" size={24} />
                  </div>
                  <div className="drag-drop-texts">
                    <p className="drag-drop-title">
                      <b>Drag & drop {fileTypeLabel.toLowerCase()} here</b>, or{" "}
                      <span className="browse-link">Browse from device</span>
                    </p>
                    <p className="drag-drop-sub">
                      {accept.includes("pdf")
                        ? "Supports PDF documents (up to 50MB)"
                        : "Supports JPG, PNG, WebP, SVG, MP4 (up to 50MB)"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {uploadError && (
            <div className="file-upload-error-msg" role="alert">
              <Icon name="close" size={14} />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* ==============================================================
          MODE 2: ONLINE URL / GOOGLE DRIVE LINK
          ============================================================== */}
      {mode === "url" && (
        <div className="url-input-container">
          <div className="url-input-field-wrap">
            <input
              id={id}
              type="text"
              className="url-text-input"
              placeholder={`Paste ${fileTypeLabel} URL or Google Drive link (e.g. https://...)`}
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
            />
            {value && (
              <button
                type="button"
                className="url-clear-btn"
                onClick={handleClear}
                title="Clear URL"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>

          {isDriveLink && (
            <div className="drive-detect-hint">
              <span className="drive-icon">📁</span>
              <span>
                <b>Google Drive link detected:</b> Direct view link will be automatically formatted for public display.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ==============================================================
          MODE 3: PRESETS
          ============================================================== */}
      {mode === "preset" && presets && presets.length > 0 && (
        <div className="presets-container">
          <div className="presets-grid">
            {presets.map((p) => {
              const selected = value === p.url;
              return (
                <button
                  key={p.url}
                  type="button"
                  className={`preset-card-btn ${selected ? "is-selected" : ""}`}
                  onClick={() => onChange(p.url)}
                >
                  <span className="preset-name">{p.label}</span>
                  <span className="preset-url">{p.url}</span>
                  {selected && <span className="preset-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick preset chips available in any mode if provided */}
      {presets && presets.length > 0 && mode !== "preset" && (
        <div className="quick-presets-strip">
          <span className="quick-presets-lbl">Quick Presets:</span>
          {presets.slice(0, 3).map((p) => (
            <button
              key={p.url}
              type="button"
              className={`quick-preset-pill ${value === p.url ? "active" : ""}`}
              onClick={() => onChange(p.url)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
