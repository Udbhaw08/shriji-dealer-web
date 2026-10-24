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
import Favorites from "./pages/Favorites";
import Schemes from "./pages/Schemes";
import Support from "./pages/Support";
import Login from "./pages/Login";
import DealerDashboard from "./pages/DealerDashboard";
import DealerApply from "./pages/DealerApply";
import StaffJoin from "./pages/StaffJoin";
import DealerPending from "./pages/DealerPending";
import ContentAdminDashboard from "./pages/ContentAdminDashboard";
import LegalPrivacy from "./pages/LegalPrivacy";
import LegalTerms from "./pages/LegalTerms";
import { useSession } from "./data/session";
import { isPortalGated } from "./data/portalGate";
import NativeBackHandler from "./components/NativeBackHandler";
import EmailVerificationPrompt from "./components/EmailVerificationPrompt";

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



function ConditionalBottomNav() {
  return <MobileBottomNav />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollManager />
        <NativeBackHandler />
        <a className="skip" href="#main">Skip to content</a>
        <Header />
        <EmailVerificationPrompt />
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
            <Route
              path="/favorites"
              element={
                <RequireVerifiedDealer>
                  <Favorites />
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
            <Route path="/privacy" element={<LegalPrivacy />} />
            <Route path="/privacy-policy" element={<LegalPrivacy />} />
            <Route path="/terms" element={<LegalTerms />} />
            <Route path="/terms-of-service" element={<LegalTerms />} />
            <Route path="/data-deletion" element={<LegalPrivacy />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dealer/apply" element={<DealerApply />} />
            <Route path="/dealer/join" element={<StaffJoin />} />
            <Route path="/join" element={<StaffJoin />} />
            <Route path="/dealer/pending" element={<DealerPending />} />
            <Route
              path="/dealer"
              element={
                <RequireVerifiedDealer>
                  <DealerDashboard />
                </RequireVerifiedDealer>
              }
            />
            <Route path="/admin" element={<ContentAdminDashboard />} />
            <Route path="/admin/content" element={<ContentAdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
        <ConditionalBottomNav />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
