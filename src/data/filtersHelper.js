/**
 * Product Size and Motor Type Filter Helpers
 * Provides standardized extraction of size and motor attributes from live Zoho catalogue items.
 */

/**
 * Extracts normalized product size (e.g. "60 CM", "75 CM", "90 CM", "1.8 L").
 * @param {Object} p Product object from Zoho catalogue
 * @returns {string|null} Normalized size label or null
 */
export function getProductSize(p) {
  if (!p) return null;
  if (p.size && typeof p.size === "string" && p.size.trim()) {
    const s = p.size.trim();
    const m = s.match(/^(60|75|90)\s*(?:cm)?$/i);
    if (m) return `${m[1]} CM`;
    return s;
  }
  const text = `${p.name || ""} ${p.zohoTitle || ""} ${p.model || ""}`;
  const isChimney = p.cat === "chimneys" || /chimney/i.test(text);
  if (isChimney) {
    const m = text.match(/\b(60|75|90)\b/i);
    if (m) return `${m[1]} CM`;
  }
  const sizeMatch = text.match(/\b(60|75|90)\s*(?:cm|CM)\b/i);
  if (sizeMatch) return `${sizeMatch[1]} CM`;

  const volMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:litre|liter|ltr|l)\b/i);
  if (volMatch && (p.cat === "small_appliances" || /cooker|kettle/i.test(text))) {
    return `${volMatch[1]} L`;
  }

  return null;
}

/**
 * Extracts normalized motor type (e.g. "BLDC").
 * @param {Object} p Product object from Zoho catalogue
 * @returns {string|null} Motor type label or null
 */
export function getProductMotorType(p) {
  if (!p) return null;
  const text = `${p.name || ""} ${p.zohoTitle || ""} ${p.model || ""}`.toLowerCase();
  const hasBldcFeature = Array.isArray(p.features) && p.features.some((f) => /bldc/i.test(f));
  const hasBldcTag = Array.isArray(p.tags) && p.tags.some((t) => /bldc/i.test(t));
  const hasBldcMotorField = p.motorType && /bldc/i.test(p.motorType);

  if (text.includes("bldc") || hasBldcFeature || hasBldcTag || hasBldcMotorField) {
    return "BLDC";
  }
  return null;
}

