import { Component, StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import "./styles.css";
import { Header, Footer, Icon } from "./ui";
import { COMPANY } from "./data/site";
import MobileBottomNav from "./components/MobileBottomNav";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Product from "./pages/Product";
import Schemes from "./pages/Schemes";
import Support from "./pages/Support";
import Login from "./pages/Login";
import { useSession } from "./data/session";
import { isPortalGated } from "./data/portalGate";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "70vh", display: "grid", placeContent: "center", textAlign: "center", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem" }}>Something went wrong</h2>
          <p style={{ margin: "1rem 0", color: "var(--tx-2)" }}>An error occurred while displaying this page.</p>
          <button
            className="btn btn-navy"
            style={{ margin: "0 auto" }}
            onClick={() => {
              this.setState({ hasError: false });
              window.location.href = "/";
            }}
          >
            Return to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      try {
        const el = document.querySelector(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      } catch {
        // Ignore invalid CSS selector in hash
      }
    }
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname, hash]);
  return null;
}

function RequireVerifiedDealer({ children }) {
  const session = useSession();
  const location = useLocation();

  if (isPortalGated(session)) {
    return <Navigate to="/login?needAuth=true" state={{ from: location }} replace />;
  }

  return children;
}

function FloatingWhatsApp() {
  return (
    <a
      href={`https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent("Hello Shriji Domestic, I would like to enquire about your appliances.")}`}
      className="floating-wa"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      title="Chat on WhatsApp"
    >
      <Icon name="wa" size={28} />
    </a>
  );
}

function ConditionalBottomNav() {
  const session = useSession();
  if (isPortalGated(session)) {
    return null;
  }
  return <MobileBottomNav />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollManager />
        <a className="skip" href="#main">Skip to content</a>
        <Header />
        <main id="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/products"
              element={
                <RequireVerifiedDealer>
                  <Products />
                </RequireVerifiedDealer>
              }
            />
            {/* Direct shared links are viewable by customer, restricted to that product */}
            <Route path="/products/:id" element={<Product />} />
            <Route
              path="/schemes"
              element={
                <RequireVerifiedDealer>
                  <Schemes />
                </RequireVerifiedDealer>
              }
            />
            <Route path="/support" element={<Support />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
        <ConditionalBottomNav />
        <FloatingWhatsApp />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
