import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../data/api";
import { Icon } from "../ui";
import { parseVideoUrl } from "../utils/video";

const BANNER_CACHE_KEY = "shriji_supabase_banners_v4";

export const DEFAULT_HERO_BANNERS = [
  {
    id: "hero-restor-hob-luxury",
    src: "/img/restor-hero-hob-luxury.jpg",
    alt: "Sunshine ReSTOR — Luxury Built-in Hob Series",
    title: "Sunshine ReSTOR — Luxury Built-in Hob Series",
    subtitle: "Engineered with Italian Beveled Tempered Glass & High-Output Forged Brass Burners. Uncompromising Culinary Precision.",
    bgColor: "#0c1926",
    link: "/products",
    order: 1,
    duration_seconds: 6,
    duration: 6,
  },
  {
    id: "hero-restor-chimney-smart",
    src: "/img/restor-hero-chimney-smart.jpg",
    alt: "Sunshine ReSTOR — Smart BLDC Chimney Hood",
    title: "Sunshine ReSTOR — Smart BLDC Chimney Hood",
    subtitle: "Whisper-Quiet BLDC Inverter Technology, Motion-Sensor Wave Controls & High-Efficiency Thermal Auto-Clean.",
    bgColor: "#0b1a2a",
    link: "/products",
    order: 2,
    duration_seconds: 6,
    duration: 6,
  },
  {
    id: "hero-restor-integrated-suite",
    src: "/img/restor-hero-integrated-suite.jpg",
    alt: "Sunshine ReSTOR — The Complete Built-in Suite",
    title: "Sunshine ReSTOR — The Complete Built-in Suite",
    subtitle: "Reimagine Your Modern Kitchen. Architecturally Integrated Hobs, Ovens & Silent Ventilation for Discerning Homes.",
    bgColor: "#132030",
    link: "/products",
    order: 3,
    duration_seconds: 6,
    duration: 6,
  },
];

const getCachedBanners = () => {
  try {
    const raw = sessionStorage.getItem(BANNER_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasLegacy = parsed.some((b) => b.id === "1st" || b.id === "2nd" || b.id === "3rd");
        if (!hasLegacy) return parsed;
      }
    }
  } catch {}
  return DEFAULT_HERO_BANNERS;
};

export default function HeroSlider({ isGated = true }) {
  const [banners, setBanners] = useState(() => getCachedBanners());
  const [sliderSettings, setSliderSettings] = useState({
    autoplay_interval: 6,
    autoplay_enabled: true,
    pause_on_hover: true,
  });
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [activeModalVideo, setActiveModalVideo] = useState(null); // { embedUrl, title, type }

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);

  // Fetch dynamic banners and slider settings from Supabase / API
  useEffect(() => {
    let active = true;
    apiFetch("/api/banners")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.banners && Array.isArray(data.banners) && data.banners.length > 0) {
          setBanners(data.banners);
          if (data.settings) {
            setSliderSettings(data.settings);
          }
          setLoading(false);
          try {
            sessionStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(data.banners));
          } catch {}
        } else {
          setBanners((curr) => (curr.length > 0 ? curr : DEFAULT_HERO_BANNERS));
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to load live banners:", err);
        if (active) {
          setBanners((curr) => (curr.length > 0 ? curr : DEFAULT_HERO_BANNERS));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const totalBanners = banners.length;
  const isSingle = totalBanners <= 1;

  const currentBanner = banners[activeIdx] || null;

  // Slide duration for the currently active banner
  const currentSlideDurationSec = Math.max(
    2,
    Number(currentBanner?.duration_seconds) ||
      Number(currentBanner?.duration) ||
      Number(currentBanner?.metadata?.duration_seconds) ||
      Number(sliderSettings?.autoplay_interval) ||
      5
  );

  const goToSlide = useCallback((index) => {
    if (isSingle) return;
    setActiveIdx((index + totalBanners) % totalBanners);
  }, [isSingle, totalBanners]);

  const nextSlide = useCallback(() => {
    if (isSingle) return;
    setActiveIdx((curr) => (curr + 1) % totalBanners);
  }, [isSingle, totalBanners]);

  const prevSlide = useCallback(() => {
    if (isSingle) return;
    setActiveIdx((curr) => (curr - 1 + totalBanners) % totalBanners);
  }, [isSingle, totalBanners]);

  // Dynamic Autoplay Loop using each slide's individual duration
  useEffect(() => {
    if (isSingle) return;
    if (sliderSettings?.autoplay_enabled === false) return;
    if (isHovered && sliderSettings?.pause_on_hover !== false) return;

    const timer = setTimeout(() => {
      setActiveIdx((curr) => (curr + 1) % totalBanners);
    }, currentSlideDurationSec * 1000);

    return () => clearTimeout(timer);
  }, [activeIdx, totalBanners, isSingle, isHovered, currentSlideDurationSec, sliderSettings]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (isSingle) return;
    if (e.key === "ArrowLeft") {
      prevSlide();
    } else if (e.key === "ArrowRight") {
      nextSlide();
    }
  };

  // Touch swipe handling for mobile
  const handleTouchStart = (e) => {
    if (isSingle) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isSwipingRef.current = true;
  };

  const handleTouchEnd = (e) => {
    if (isSingle || !isSwipingRef.current) return;
    isSwipingRef.current = false;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  };

  const renderSlideContent = (slide, idx) => {
    const rawVideo = slide.videoUrl || slide.video_url || null;
    const videoInfo = rawVideo ? parseVideoUrl(rawVideo) : null;
    const isCurrentActive = idx === activeIdx;

    // Check if title is substantial (not just "video" placeholder)
    const rawTitle = (slide.title || "").trim();
    const hasMeaningfulTitle = rawTitle && rawTitle.toLowerCase() !== "video";
    const hasMeaningfulSubtitle = Boolean((slide.subtitle || "").trim());

    // 1. Render Video Media if video exists
    if (videoInfo) {
      const isEmbed = videoInfo.type === "youtube" || videoInfo.type === "vimeo" || videoInfo.type === "drive";

      return (
        <div className="store-banner-video-wrap">
          {/* Backdrop poster/thumbnail while iframe loads or for background filler */}
          {(slide.src || videoInfo.thumbnail) && (
            <img
              src={slide.src || videoInfo.thumbnail}
              alt=""
              aria-hidden="true"
              className="store-banner-img"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "brightness(0.7)",
                zIndex: 0,
              }}
            />
          )}

          {/* Embedded Player (YouTube, Vimeo, Google Drive) */}
          {isEmbed && isCurrentActive && (
            <iframe
              src={videoInfo.embedUrl}
              title={slide.title || "Hero Video"}
              className="store-banner-iframe"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading={idx === 0 ? "eager" : "lazy"}
              style={{ zIndex: 1 }}
            />
          )}

          {/* Direct HTML5 Video (MP4 / WebM / Uploaded file) */}
          {!isEmbed && (
            <video
              src={videoInfo.src}
              poster={slide.src || undefined}
              autoPlay
              loop
              muted
              playsInline
              className="store-banner-img"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                zIndex: 1,
              }}
            />
          )}

          {/* Sound & Fullscreen Action Button */}
          <button
            type="button"
            className="store-banner-sound-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveModalVideo({
                title: slide.title || "Watch Video",
                embedUrl: videoInfo.soundEmbedUrl || videoInfo.embedUrl || videoInfo.src,
                type: videoInfo.type,
                src: videoInfo.src,
              });
            }}
            title="Play with audio / full screen"
          >
            <Icon name="play" size={13} />
            <span>Watch with Sound</span>
          </button>

          {/* Caption Overlay (if meaningful title or subtitle is provided) */}
          {(hasMeaningfulTitle || hasMeaningfulSubtitle) && (
            <div className="store-banner-video-caption">
              <span className="stitch-hero-eyebrow" style={{ fontSize: "0.68rem", marginBottom: "3px", display: "block" }}>
                ReSTOR Spotlight
              </span>
              {hasMeaningfulTitle && <h2 className="store-banner-video-title">{slide.title}</h2>}
              {hasMeaningfulSubtitle && <p className="store-banner-video-sub">{slide.subtitle}</p>}
            </div>
          )}

          {/* Dedicated CTA button if slide has a target link */}
          {slide.link && slide.link !== "#" && (
            <div
              style={{
                position: "absolute",
                bottom: "16px",
                right: "16px",
                zIndex: 4,
              }}
            >
              {slide.link.startsWith("http") ? (
                <a
                  href={slide.link}
                  target="_blank"
                  rel="noreferrer"
                  className="stitch-cta-primary"
                  style={{ padding: "6px 14px", fontSize: "0.82rem", borderRadius: "8px" }}
                >
                  <span>Explore</span> <Icon name="arrow" size={13} />
                </a>
              ) : (
                <Link
                  to={slide.link}
                  className="stitch-cta-primary"
                  style={{ padding: "6px 14px", fontSize: "0.82rem", borderRadius: "8px" }}
                >
                  <span>Explore</span> <Icon name="arrow" size={13} />
                </Link>
              )}
            </div>
          )}
        </div>
      );
    }

    // 2. Render Static Image Banner
    const imageEl = slide.src ? (
      <img
        src={slide.src}
        alt={slide.alt || slide.title || "Banner"}
        className="store-banner-img"
        loading={idx === 0 ? "eager" : "lazy"}
        draggable={false}
      />
    ) : (
      <div className="stitch-hero-card">
        <div className="stitch-hero-glow-1" aria-hidden="true" />
        <div className="stitch-hero-glow-2" aria-hidden="true" />
        <div className="stitch-hero-inner">
          <span className="stitch-hero-eyebrow">ReSTOR Portal</span>
          <div className="stitch-hero-stack">
            <h1 className="stitch-hero-h1">{slide.title || "ReSTOR"}</h1>
            {slide.subtitle ? (
              <p className="stitch-hero-sub1">{slide.subtitle}</p>
            ) : (
              <>
                <p className="stitch-hero-sub1">Reimagine</p>
                <p className="stitch-hero-sub2">Rebuild</p>
                <p className="stitch-hero-sub3">Restart</p>
              </>
            )}
          </div>
          <p className="stitch-hero-desc">
            Official B2B distributor portal for Sunshine kitchen appliances.
          </p>
        </div>
      </div>
    );

    if (slide.link) {
      const isExternal = slide.link.startsWith("http://") || slide.link.startsWith("https://");
      return isExternal ? (
        <a
          href={slide.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", width: "100%", height: "100%" }}
        >
          {imageEl}
        </a>
      ) : (
        <Link to={slide.link} style={{ display: "block", width: "100%", height: "100%" }}>
          {imageEl}
        </Link>
      );
    }

    return imageEl;
  };

  if (banners.length === 0) {
    if (loading) {
      return (
        <section className="store-banner-section" aria-label="Loading Store Banners">
          <div className="wrap">
            <div
              className="store-banner-viewport"
              style={{
                background: "linear-gradient(135deg, #0e2438 0%, #173752 100%)",
                borderRadius: "var(--r3, 14px)",
                minHeight: 280,
                display: "grid",
                placeItems: "center",
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>
                <span className="live-db-dot" /> Loading live showcase…
              </div>
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section
      className="store-banner-section"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Store Promotional Banners"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="wrap">
        <div
          className="store-banner-viewport"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Horizontal Sliding Track */}
          <div
            className="store-banner-track"
            style={{
              transform: `translateX(-${activeIdx * 100}%)`,
              transition: isSingle ? "none" : "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            {banners.map((slide, idx) => (
              <div
                key={slide.id || idx}
                className="store-banner-slide"
                style={{ background: slide.bgColor || "#0110a7" }}
                aria-hidden={idx !== activeIdx}
              >
                {renderSlideContent(slide, idx)}
              </div>
            ))}
          </div>

          {/* Chevrons (only when multiple banners exist) */}
          {!isSingle && (
            <>
              <button
                type="button"
                className="store-carousel-nav prev"
                onClick={prevSlide}
                aria-label="Previous banner"
                title="Previous"
              >
                <Icon name="chevleft" size={24} />
              </button>
              <button
                type="button"
                className="store-carousel-nav next"
                onClick={nextSlide}
                aria-label="Next banner"
                title="Next"
              >
                <Icon name="chev" size={24} />
              </button>
            </>
          )}
        </div>

        {/* Minimalist Pagination Dots */}
        {!isSingle && (
          <div className="store-banner-dots-row" role="tablist" aria-label="Banner indicators">
            {banners.map((slide, idx) => (
              <button
                key={slide.id || idx}
                type="button"
                role="tab"
                aria-selected={idx === activeIdx}
                aria-label={`Slide ${idx + 1}`}
                className={`store-dot-pill ${idx === activeIdx ? "active" : ""}`}
                onClick={() => goToSlide(idx)}
              />
            ))}
          </div>
        )}

        {/* Clean Dealer Portal Actions below banner */}
        <div className="store-banner-actions">
          <Link className="stitch-cta-white" to="/products">
            <span>Explore Products</span>
            <span className="stitch-cta-arrow-circle"><Icon name="arrow" size={15} /></span>
          </Link>
          <Link className="stitch-cta-primary" to="/schemes">
            <span>Dealer Schemes</span>
            <span className="stitch-cta-arrow"><Icon name="arrow" size={17} /></span>
          </Link>
        </div>
      </div>

      {/* Fullscreen Video Modal (High-Fidelity Audio & Controls) */}
      {activeModalVideo && (
        <div
          className="video-lightbox-backdrop"
          onClick={() => setActiveModalVideo(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="video-lightbox-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="video-lightbox-close"
              onClick={() => setActiveModalVideo(null)}
              aria-label="Close video"
            >
              ×
            </button>
            {activeModalVideo.type === "direct" ? (
              <video
                src={activeModalVideo.src}
                controls
                autoPlay
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <iframe
                src={activeModalVideo.embedUrl}
                title={activeModalVideo.title}
                style={{ width: "100%", height: "100%", border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
