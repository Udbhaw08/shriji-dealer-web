import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/**
 * Handles Android hardware back button & Capacitor gesture back navigation.
 * Prevents abrupt app exits by managing overlay dismissals and stack transitions:
 * 1. Dismisses active modals, lightboxes, filter drawers, or open menus.
 * 2. Navigates back in history (e.g. Product -> Favorites or Product -> Products).
 * 3. Falls back gracefully to Home ("/") if history stack is empty.
 * 4. Only exits the application when the user is already on the Home screen ("/").
 */
export default function NativeBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    let listenerHandle = null;

    const setupListener = async () => {
      try {
        if (!Capacitor.isNativePlatform()) return;

        listenerHandle = await App.addListener("backButton", () => {
          // 1. Close image lightbox if open
          const lightboxCloseBtn = document.querySelector(".image-lightbox-close");
          if (lightboxCloseBtn) {
            lightboxCloseBtn.click();
            return;
          }

          // 2. Close microphone permission in-app modal if open
          const micModal = document.querySelector(".mic-modal-overlay");
          if (micModal) {
            const cancelBtn = micModal.querySelector(".mic-modal-btn-cancel");
            if (cancelBtn) cancelBtn.click();
            else micModal.remove();
            return;
          }

          // 3. Close mobile hamburger menu if open
          const mobileNav = document.querySelector(".nav.open");
          if (mobileNav) {
            const burgerBtn = document.querySelector(".icon-btn.burger");
            if (burgerBtn) burgerBtn.click();
            return;
          }

          // 4. Close product filter sheet or drawer if open
          const filterSheet = document.querySelector(".filters-sheet");
          if (filterSheet) {
            const sheetBackOrClose = filterSheet.querySelector(".sheet-back-btn, .sheet-close-btn");
            if (sheetBackOrClose) {
              sheetBackOrClose.click();
              return;
            }
          }
          const filterAside = document.querySelector("aside.filters[data-open='true']");
          if (filterAside) {
            const filterBtn = document.querySelector(".icon-btn.filter-btn");
            if (filterBtn) filterBtn.click();
            return;
          }

          // 5. Close search autocomplete suggestions dropdown
          const searchDrop = document.querySelector(".search-drop");
          if (searchDrop) {
            const activeInput = document.activeElement;
            if (activeInput && typeof activeInput.blur === "function") {
              activeInput.blur();
            }
            return;
          }

          // 6. Stack & route navigation
          const currentPath = locationRef.current.pathname;

          if (currentPath === "/") {
            // Already at Home -> Exit the native app
            App.exitApp();
            return;
          }

          // If on product detail or sub-page, step back in history if possible
          if (window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0) {
            navigate(-1);
          } else {
            // If no previous history exists in this session, return to Home or Products
            if (currentPath.startsWith("/products/")) {
              navigate("/products");
            } else {
              navigate("/");
            }
          }
        });
      } catch (err) {
        console.warn("Could not register native backButton listener:", err);
      }
    };

    setupListener();

    return () => {
      if (listenerHandle && typeof listenerHandle.remove === "function") {
        listenerHandle.remove();
      }
    };
  }, [navigate]);

  return null;
}
