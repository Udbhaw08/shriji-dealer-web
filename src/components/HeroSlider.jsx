import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../data/api";
import { Icon } from "../ui";

export const STORE_BANNERS = [
  {
    id: "1st",
    src: "/img/1st.jpeg",
    alt: "ReSTOR — Reimagine, Rebuild, Restart",
    title: "ReSTOR — Reimagine, Rebuild, Restart",
    bgColor: "#0110a7",
    link: "/products",
  },
  {
    id: "2nd",
    src: "/img/2nd.jpeg",
    alt: "Sunshine Defender Series — Matte Finish Toughened Glass",
    title: "Sunshine Defender Series — Matte Finish Toughened Glass",
    bgColor: "#95a5b5",
    link: "/products?search=Defender",
  },
  {
    id: "3rd",
    src: "/img/3rd.jpeg",
    alt: "Sunshine Shine Platinum — Matte Toughened Glass Cooktop",
    title: "Sunshine Shine Platinum — Matte Toughened Glass Cooktop",
    bgColor: "#ffffff",
    link: "/products?search=Platinum",
  },
];

const AUTO_INTERVAL = 4000; // 4 seconds continuous loop

export default function HeroSlider({ isGated = true }) {
  const [banners, setBanners] = useState(STORE_BANNERS);
  const [activeIdx, setActiveIdx] = useState(0);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const timerRef = useRef(null);

  // Fetch dynamic banners from Zoho via /api/banners
  useEffect(() => {
    let active = true;
    apiFetch("/api/banners")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.banners && Array.isArray(data.banners) && data.banners.length > 0) {
          setBanners(data.banners);
          setActiveIdx(0);
        }
      })
      .catch((err) => console.warn("Failed to load live banners:", err));

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
    ) : (
      <img
        src={slide.src}
        alt={slide.alt || slide.title || "Banner"}
        className="store-banner-img"
        loading={idx === 0 ? "eager" : "lazy"}
        draggable={false}
      />
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

          {/* Pagination Dots (only when multiple banners exist) */}
          {!isSingle && (
            <div className="store-carousel-dots" role="tablist" aria-label="Banner indicators">
              {banners.map((slide, idx) => (
                <button
                  key={slide.id || idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === activeIdx}
                  aria-label={`Slide ${idx + 1}`}
                  className={`store-carousel-dot ${idx === activeIdx ? "active" : ""}`}
                  onClick={() => goToSlide(idx)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Clean Dealer Portal Actions below banner */}
        <div className="store-banner-actions">
          {isGated ? (
            <>
              <Link className="btn btn-navy" to="/login">
                Verified Dealer Login <Icon name="arrow" size={17} />
              </Link>
              <Link className="btn btn-ghost" to="/login?tab=apply">
                Apply for Dealership
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-primary" to="/products">
                Browse Wholesale Catalog <Icon name="arrow" size={17} />
              </Link>
              <Link className="btn btn-ghost" to="/schemes">
                View Active Schemes
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
