import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";
import { useProducts } from "../data/productsStore";
import { productSlug } from "../data/dealer";
import { getSuggestions, buildSearchDictionary, autocorrectQuery } from "../data/searchHelper";

export default function ProductSearchBar({
  value = "",
  onChange,
  onSubmit,
  placeholder,
  autoNavigate = false,
  className = "",
  style,
}) {
  const { t, isHindi } = useLanguage();
  const { products: PRODUCTS, categories: CATEGORIES } = useProducts();
  const navigate = useNavigate();

  const [inputVal, setInputVal] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTooltip, setVoiceTooltip] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);

  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const tooltipTimerRef = useRef(null);

  const showTooltip = (msg, durationMs = 2500) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setVoiceTooltip(msg);
    if (durationMs > 0 && msg) {
      tooltipTimerRef.current = setTimeout(() => {
        setVoiceTooltip("");
        tooltipTimerRef.current = null;
      }, durationMs);
    }
  };

  // Sync external value changes
  useEffect(() => {
    setInputVal(value);
  }, [value]);

  // Clean up recognition & timers on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
        showTooltip("", 0);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, []);

  // Compute suggestions and autocorrect
  const suggestions = useMemo(() => {
    return getSuggestions(PRODUCTS, CATEGORIES, inputVal);
  }, [PRODUCTS, CATEGORIES, inputVal]);

  const dict = useMemo(() => {
    return buildSearchDictionary(PRODUCTS, CATEGORIES);
  }, [PRODUCTS, CATEGORIES]);

  const autocorrect = useMemo(() => {
    if (!inputVal || inputVal.trim().length < 3) return null;
    const res = autocorrectQuery(inputVal, dict);
    return res.hasCorrection ? res.corrected : null;
  }, [inputVal, dict]);

  // Voice Search setup
  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const requestMicAccess = async () => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (err) {
        console.warn("Microphone access check failed:", err);
        return false;
      }
    }
    return true;
  };

  const startVoiceSearch = async () => {
    if (!hasSpeechRecognition) {
      showTooltip(t("voice_not_supported") || "Voice search not supported in this browser", 3000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
      setIsListening(false);
      showTooltip("", 0);
      return;
    }

    // Proactively request audio stream to trigger system permission dialog on Android / iOS WebView
    const hasPermission = await requestMicAccess();
    if (!hasPermission) {
      showTooltip("", 0);
      setShowMicPermissionModal(true);
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.lang = isHindi ? "hi-IN" : "en-IN";
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => {
        setIsListening(true);
        showTooltip(t("voice_listening") || "Listening… Speak now", 0);
      };

      rec.onresult = (e) => {
        const transcript = e.results[0]?.[0]?.transcript || "";
        const clean = transcript.trim().replace(/\.+$/, "");
        if (clean) {
          setInputVal(clean);
          if (onChange) onChange(clean);
          setIsOpen(true);
          showTooltip(`“${clean}”`, 2000);
          if (onSubmit) onSubmit(clean);
        } else {
          showTooltip("", 0);
        }
        setIsListening(false);
      };

      rec.onerror = (e) => {
        console.warn("Speech recognition error:", e.error);
        setIsListening(false);
        if (e.error === "aborted") {
          showTooltip("", 0);
          return;
        }
        if (e.error === "not-allowed" || e.error === "audio-capture") {
          showTooltip("", 0);
          setShowMicPermissionModal(true);
          return;
        }
        const msg =
          e.error === "no-speech"
            ? (t("voice_no_speech") || "No speech detected")
            : (t("voice_error") || "Voice search error");
        showTooltip(msg, 2500);
      };

      rec.onend = () => {
        setIsListening(false);
        // Clear listening tooltip immediately if it was not already replaced by transcript
        setVoiceTooltip((prev) => {
          if (prev.includes("Listening") || prev.includes("सुन रहे")) {
            return "";
          }
          return prev;
        });
        recognitionRef.current = null;
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn("Speech recognition initialization failed:", err);
      setIsListening(false);
      setShowMicPermissionModal(true);
    }
  };

  const handleInputChange = (e) => {
    const nextVal = e.target.value;
    setInputVal(nextVal);
    setIsOpen(true);
    setHighlightIdx(-1);
    if (onChange) onChange(nextVal);
  };

  const handleApplyTerm = (term) => {
    setInputVal(term);
    setIsOpen(false);
    if (onChange) onChange(term);
    if (onSubmit) onSubmit(term);
    if (autoNavigate) {
      navigate(`/products?q=${encodeURIComponent(term)}`);
    }
  };

  const handleSelectProduct = (p) => {
    setIsOpen(false);
    const targetSlug = p.slug || productSlug(p) || p.id;
    navigate(`/products/${targetSlug}`);
  };

  const handleSelectCategory = (catKey) => {
    setIsOpen(false);
    navigate(`/products?cat=${catKey}`);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setIsOpen(false);
    if (onSubmit) {
      onSubmit(inputVal);
    } else if (autoNavigate && inputVal.trim()) {
      navigate(`/products?q=${encodeURIComponent(inputVal.trim())}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      if (highlightIdx >= 0 && suggestions.products[highlightIdx]) {
        e.preventDefault();
        handleSelectProduct(suggestions.products[highlightIdx]);
      } else {
        handleSubmit(e);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightIdx((prev) => Math.min(prev + 1, suggestions.products.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, -1));
    }
  };

  return (
    <div className={`search-bar-wrap ${className}`.trim()} ref={wrapRef} style={style}>
      <form onSubmit={handleSubmit} className="search search-interactive" role="search">
        <Icon name="search" size={17} style={{ color: "var(--tx-3)", flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="search"
          value={inputVal}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t("search_app_placeholder") || "Search products, models, categories…"}
          aria-label={placeholder || "Search products"}
          autoComplete="off"
        />

        {inputVal && (
          <button
            type="button"
            className="search-clear-btn"
            aria-label="Clear search"
            onClick={() => {
              setInputVal("");
              if (onChange) onChange("");
              if (inputRef.current) inputRef.current.focus();
            }}
          >
            <Icon name="close" size={14} />
          </button>
        )}

        <button
          type="button"
          className={`search-mic-btn ${isListening ? "listening" : ""}`}
          onClick={startVoiceSearch}
          aria-label={isListening ? "Listening…" : "Search with voice"}
          title={isListening ? "Listening…" : "Search with voice"}
        >
          <Icon name="mic" size={17} />
          {isListening && <span className="mic-pulse" />}
        </button>
      </form>

      {/* Voice Status Tooltip */}
      {voiceTooltip && (
        <div
          className={`search-voice-toast ${isListening ? "active" : ""}`}
          onClick={() => {
            if (isListening && recognitionRef.current) {
              try {
                recognitionRef.current.abort();
              } catch {}
            }
            setIsListening(false);
            showTooltip("", 0);
          }}
          title="Click to dismiss"
          style={{ cursor: "pointer" }}
        >
          <Icon name="mic" size={14} />
          <span>{voiceTooltip}</span>
        </div>
      )}

      {/* Dropdown Suggestions */}
      {isOpen && (
        <div className="search-drop search-drop-enhanced">
          {/* Popular searches when input is empty */}
          {!inputVal.trim() && suggestions.popular.length > 0 && (
            <div className="search-popular-sec">
              <span className="search-section-label">Popular Searches</span>
              <div className="search-popular-tags">
                {suggestions.popular.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="search-popular-tag"
                    onClick={() => handleApplyTerm(term)}
                  >
                    <Icon name="sparkle" size={12} />
                    <span>{term}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Autocorrect banner inside dropdown if typo detected */}
          {suggestions.correction && suggestions.correction !== inputVal.trim().toLowerCase() && (
            <div className="search-drop-correction">
              <span>{t("did_you_mean") || "Did you mean:"}</span>
              <button
                type="button"
                className="correction-link"
                onClick={() => handleApplyTerm(suggestions.correction)}
              >
                <b>{suggestions.correction}</b>
              </button>
            </div>
          )}

          {/* Category shortcuts */}
          {suggestions.categories.length > 0 && (
            <div className="search-cat-shortcuts">
              <span className="search-section-label">Categories</span>
              {suggestions.categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="search-cat-item"
                  onClick={() => handleSelectCategory(c.key)}
                >
                  <Icon name={c.key === "chimneys" ? "chimney" : "stove"} size={16} />
                  <span>In <b>{c.label}</b></span>
                  <Icon name="arrowsm" size={13} style={{ marginLeft: "auto" }} />
                </button>
              ))}
            </div>
          )}

          {/* Product suggestions */}
          {suggestions.products.length > 0 ? (
            <div className="search-drop-list">
              <span className="search-section-label">Products</span>
              {suggestions.products.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  className={`search-drop-item ${idx === highlightIdx ? "highlighted" : ""}`}
                  onClick={() => handleSelectProduct(p)}
                >
                  <span className="search-drop-thumb">
                    {p.img ? (
                      <img src={p.img.startsWith("http") ? p.img : `/img/${p.img}`} alt="" />
                    ) : (
                      <Icon name="stove" size={18} />
                    )}
                  </span>
                  <span className="search-drop-info">
                    <b>{p.model && p.model.toLowerCase() !== "test" ? p.model : p.name}</b>
                    <small>{[p.catLabel, p.finish, p.size].filter(Boolean).join(" · ")}</small>
                  </span>
                  <Icon name="chev" size={13} className="search-drop-arrow" />
                </button>
              ))}
            </div>
          ) : (
            inputVal.trim() && (
              <div className="search-drop-empty">
                <span>No products found for “{inputVal.trim()}”</span>
                {autocorrect && (
                  <p style={{ marginTop: "6px", fontSize: "0.82rem" }}>
                    Try searching for{" "}
                    <button
                      type="button"
                      className="link"
                      onClick={() => handleApplyTerm(autocorrect)}
                    >
                      {autocorrect}
                    </button>
                  </p>
                )}
              </div>
            )
          )}

          {/* View all results button */}
          {inputVal.trim() && (
            <button
              type="button"
              className="search-drop-all"
              onClick={handleSubmit}
            >
              <span>{t("view_all") || "View all"} results for “{inputVal.trim()}”</span>
              <Icon name="arrowsm" size={15} />
            </button>
          )}
        </div>
      )}

      {/* In-app Microphone Permission Modal */}
      {showMicPermissionModal && (
        <div
          className="mic-modal-overlay"
          onClick={() => setShowMicPermissionModal(false)}
        >
          <div
            className="mic-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mic-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mic-modal-header">
              <div className="mic-modal-icon-badge">
                <Icon name="mic" size={24} />
              </div>
              <div>
                <h3 id="mic-modal-title" className="mic-modal-title">
                  {t("mic_permission_title")}
                </h3>
              </div>
            </div>

            <p className="mic-modal-desc">{t("mic_permission_desc")}</p>

            <div className="mic-modal-steps">
              <div className="mic-modal-step-item">
                <span className="mic-step-num">1</span>
                <span>
                  {isHindi
                    ? "सिस्टम अनुमति प्रॉम्प्ट (System Prompt) में 'Allow' या 'While using the app' चुनें।"
                    : "When prompted by your system, choose 'Allow' or 'While using the app'."}
                </span>
              </div>
              <div className="mic-modal-step-item">
                <span className="mic-step-num">2</span>
                <span>{t("mic_permission_steps")}</span>
              </div>
            </div>

            <div className="mic-modal-actions">
              <button
                type="button"
                className="mic-modal-btn-allow"
                onClick={async () => {
                  setShowMicPermissionModal(false);
                  await startVoiceSearch(true);
                }}
              >
                <Icon name="mic" size={16} />
                <span>{t("mic_permission_allow")}</span>
              </button>
              <button
                type="button"
                className="mic-modal-btn-cancel"
                onClick={() => setShowMicPermissionModal(false)}
              >
                {t("mic_permission_cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
