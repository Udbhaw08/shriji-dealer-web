import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../ui";

export const STORE_BANNERS = [
  {
    id: "1st",
    src: "/img/1st.jpeg",
    alt: "ReSTOR — Reimagine, Rebuild, Restart",
    bgColor: "#0110a7",
  },
  {
    id: "2nd",
    src: "/img/2nd.jpeg",
    alt: "Sunshine Defender Series — Matte Finish Toughened Glass",
    bgColor: "#95a5b5",
  },
  {
    id: "3rd",
    src: "/img/3rd.jpeg",
    alt: "Sunshine Shine Platinum — Matte Toughened Glass Cooktop",
    bgColor: "#ffffff",
  },
];

const AUTO_INTERVAL = 3500; // 3.5 seconds continuous loop

export default function HeroSlider({ isGated = true }) {
  const [activeIdx, setActiveIdx] = useState(0);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const timerRef = useRef(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx((curr) => (curr + 1) % STORE_BANNERS.length);
    }, AUTO_INTERVAL);
  }, []);

  const goToSlide = useCallback((index) => {
    setActiveIdx((index + STORE_BANNERS.length) % STORE_BANNERS.length);
    resetTimer();
  }, [resetTimer]);

  const nextSlide = useCallback(() => {
    setActiveIdx((curr) => (curr + 1) % STORE_BANNERS.length);
    resetTimer();
  }, [resetTimer]);

  const prevSlide = useCallback(() => {
    setActiveIdx((curr) => (curr - 1 + STORE_BANNERS.length) % STORE_BANNERS.length);
    resetTimer();
  }, [resetTimer]);

  // Continuous auto-slide loop
  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      prevSlide();
    } else if (e.key === "ArrowRight") {
      nextSlide();
    }
  };

  // Touch swipe handling for mobile
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isSwipingRef.current = true;
  };

  const handleTouchEnd = (e) => {
    if (!isSwipingRef.current) return;
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

  return (
    <section
      className="store-banner-section"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Store Promotional Banners"
    >
      <div className="wrap">
        {/* Amazon / Flipkart Style Sliding Banner Carousel */}
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
              transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            {STORE_BANNERS.map((slide, idx) => (
              <div
                key={slide.id}
                className="store-banner-slide"
                style={{ background: slide.bgColor }}
                aria-hidden={idx !== activeIdx}
              >
                <img
                  src={slide.src}
                  alt={slide.alt}
                  className="store-banner-img"
                  loading={idx === 0 ? "eager" : "lazy"}
                  draggable={false}
                />
              </div>
            ))}
          </div>

          {/* Flipkart / Amazon Style Navigation Chevrons */}
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

          {/* Flipkart / Amazon Minimalist Pagination Dots */}
          <div className="store-carousel-dots" role="tablist" aria-label="Banner indicators">
            {STORE_BANNERS.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={idx === activeIdx}
                aria-label={`Slide ${idx + 1}`}
                className={`store-carousel-dot ${idx === activeIdx ? "active" : ""}`}
                onClick={() => goToSlide(idx)}
              />
            ))}
          </div>
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
