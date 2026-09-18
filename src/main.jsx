import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./styles.css";
import { Header, Footer } from "./ui";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Product from "./pages/Product";
import Schemes from "./pages/Schemes";
import Support from "./pages/Support";
import Login from "./pages/Login";

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) return el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollManager />
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<Product />} />
          <Route path="/schemes" element={<Schemes />} />
          <Route path="/support" element={<Support />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Product />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  </StrictMode>,
);
