import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../data/api";
import { Icon } from "../ui";

const BANNER_CACHE_KEY = "shriji_supabase_banners_v2";

const getCachedBanners = () => {
  try {
    const raw = sessionStorage.getItem(BANNER_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Discard any legacy Zoho banner IDs
        const hasLegacy = parsed.some((b) => b.id === "1st" || b.id === "2nd" || b.id === "3rd");
        if (!hasLegacy) return parsed;
      }
    }
  } catch {}
  return [];
};

const AUTO_INTERVAL = 4000; // 4 seconds continuous loop

export default function HeroSlider({ isGated = true }) {
  const [banners, setBanners] = useState(() => getCachedBanners());
  const [loading, setLoading] = useState(() => banners.length === 0);
  const [activeIdx, setActiveIdx] = useState(0);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const timerRef = useRef(null);

  // Fetch dynamic banners from Supabase via /api/banners
  useEffect(() => {
    let active = true;
    apiFetch("/api/banners")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.banners && Array.isArray(data.banners) && data.banners.length > 0) {
          setBanners(data.banners);
          setLoading(false);
          try {
            sessionStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(data.banners));
          } catch {}
        } else if (active) {
          setBanners([]);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to load live banners:", err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const totalBanners = banners.length;
  const isSingle = totalBanners <= 1;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isSingle) return;
    timerRef.current = setInterval(() => {
      setActiveIdx((curr) => (curr + 1) % totalBanners);
    }, AUTO_INTERVAL);
  }, [isSingle, totalBanners]);

  const goToSlide = useCallback((index) => {
    if (isSingle) return;
    setActiveIdx((index + totalBanners) % totalBanners);
    resetTimer();
  }, [isSingle, totalBanners, resetTimer]);

  const nextSlide = useCallback(() => {
    if (isSingle) return;
    setActiveIdx((curr) => (curr + 1) % totalBanners);
    resetTimer();
  }, [isSingle, totalBanners, resetTimer]);

  const prevSlide = useCallback(() => {
    if (isSingle) return;
    setActiveIdx((curr) => (curr - 1 + totalBanners) % totalBanners);
    resetTimer();
  }, [isSingle, totalBanners, resetTimer]);

  // Continuous auto-slide loop (paused if only 1 banner)
  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

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
    const isMp4 = slide.videoUrl && (slide.videoUrl.endsWith(".mp4") || slide.videoUrl.endsWith(".webm") || slide.videoUrl.includes(".mp4?") || slide.videoUrl.includes(".webm?"));

    const mediaEl = isMp4 ? (
      <video
        src={slide.videoUrl}
        poster={slide.src}
        autoPlay
        loop
        muted
        playsInline
        className="store-banner-img"
        style={{ objectFit: "cover", width: "100%", height: "100%" }}
      />
    ) : slide.src ? (
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

    const slideContent = (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {mediaEl}
        {slide.videoUrl && !isMp4 && (
          <span
            style={{
              position: "absolute",
              bottom: "14px",
              right: "14px",
              zIndex: 3,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              backdropFilter: "blur(8px)",
              background: "rgba(1, 16, 167, 0.85)",
              color: "#fff",
              padding: "5px 12px",
              borderRadius: "999px",
              fontSize: "0.78rem",
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            <Icon name="play" size={13} /> {slide.driveVideo?.isDrive ? "Drive Video" : "Watch Video"}
          </span>
        )}
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
          {slideContent}
        </a>
      ) : (
        <Link to={slide.link} style={{ display: "block", width: "100%", height: "100%" }}>
          {slideContent}
        </Link>
      );
    }

    return slideContent;
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
    >
      <div className="wrap">
        {/* Amazon / Flipkart Style Sliding Banner Carousel or Static Hero */}
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

        {/* Minimalist Pagination Dots below banner */}
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

        {/* Clean Dealer Portal Actions below banner (Matches Stitch Frame 1) */}
        <div className="store-banner-actions">
          {isGated ? (
            <>
              <Link className="stitch-cta-primary" to="/login">
                <span>Verified Dealer Login</span>
                <span className="stitch-cta-arrow"><Icon name="arrow" size={17} /></span>
              </Link>
              <Link className="stitch-cta-white" to="/login?tab=apply">
                <span>Apply for Dealership</span>
                <span className="stitch-cta-arrow-circle"><Icon name="arrow" size={15} /></span>
              </Link>
            </>
          ) : (
            <>
              <Link className="stitch-cta-white" to="/products">
                <span>Browse Wholesale Catalog</span>
                <span className="stitch-cta-arrow-circle"><Icon name="arrow" size={15} /></span>
              </Link>
              <Link className="stitch-cta-primary" to="/schemes">
                <span>View Active Schemes</span>
                <span className="stitch-cta-arrow"><Icon name="arrow" size={17} /></span>
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
