import { COMPANY } from "./site.js";

// Levenshtein distance for fuzzy matching & typo tolerance
export function levenshteinDistance(s1, s2) {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Common Indian kitchen colloquial synonyms that aren't simple edit-distance typos
const COLLOQUIAL_SYNONYMS = {
  chulha: "gas stove",
  chula: "gas stove",
  chooha: "gas stove",
  hood: "chimney",
  exhaust: "chimney",
  range: "gas stove",
  oven: "gas stove",
  sigdi: "gas stove",
  shegdi: "gas stove",
  burner: "burner",
  chulhas: "gas stoves",
};

// Dynamically build vocabulary dictionary from live catalog data
export function buildSearchDictionary(products = [], categories = []) {
  const vocab = new Set();

  // 1. Company & Brand Names
  if (COMPANY.brand) {
    COMPANY.brand.toLowerCase().split(/\s+/).forEach((w) => w.length > 1 && vocab.add(w));
  }
  if (COMPANY.legal) {
    COMPANY.legal.toLowerCase().split(/[\s/,-]+/).forEach((w) => w.length > 2 && vocab.add(w));
  }

  // 2. All Live Categories (labels and slug keys)
  for (const c of categories) {
    if (c.label) {
      c.label.toLowerCase().split(/[\s/,-]+/).forEach((w) => w.length > 2 && vocab.add(w));
    }
    if (c.key) {
      c.key.toLowerCase().split(/[_-]+/).forEach((w) => w.length > 2 && vocab.add(w));
    }
  }

  // 3. All Live Products (models, full titles, codes, finishes, sizes, brands, features)
  for (const p of products) {
    // Model name (e.g. "CT 753", "Jupiter", "Onyx")
    if (p.model) {
      p.model.toLowerCase().split(/[\s/,-]+/).forEach((w) => w.length > 1 && vocab.add(w));
    }
    // Full product title / description
    if (p.name) {
      p.name.toLowerCase().split(/[\s/,-]+/).forEach((w) => w.length > 2 && vocab.add(w));
    }
    // Item code / SKU
    if (p.code) {
      vocab.add(p.code.toLowerCase());
    }
    // Brand (e.g. "Sunshine")
    if (p.brand) {
      p.brand.toLowerCase().split(/\s+/).forEach((w) => w.length > 1 && vocab.add(w));
    }
    // Finish (e.g. "Glass", "Stainless Steel", "Black Toughened")
    if (p.finish) {
      p.finish.toLowerCase().split(/[\s/,-]+/).forEach((w) => w.length > 2 && vocab.add(w));
    }
    // Burners & size tokens (e.g. "2 burner", "60cm", "90cm")
    if (p.burners) {
      vocab.add(`${p.burners}`);
      vocab.add(`${p.burners}b`);
      vocab.add("burner");
      vocab.add("burners");
    }
    if (p.size) {
      p.size.toLowerCase().split(/\s+/).forEach((w) => vocab.add(w));
    }
    // Features array
    if (Array.isArray(p.features)) {
      p.features.forEach((f) =>
        f.toLowerCase().split(/[\s/,-]+/).forEach((w) => w.length > 2 && vocab.add(w))
      );
    }
  }

  return Array.from(vocab);
}

// Generate popular searches dynamically from the current active catalog
export function getPopularSearches(products = [], categories = []) {
  const suggestions = [];

  // Top categories from live data
  for (const c of categories.slice(0, 3)) {
    if (c.label) suggestions.push(c.label);
  }

  // Top distinct finishes / attributes from products
  const finishes = new Set();
  for (const p of products) {
    if (p.burners && p.burners >= 3) {
      suggestions.push(`${p.burners} Burner Gas Stove`);
      break;
    }
  }
  for (const p of products) {
    if (p.features?.includes("Auto Ignition")) {
      suggestions.push("Auto Ignition Hob");
      break;
    }
  }
  for (const p of products) {
    if (p.finish && !finishes.has(p.finish)) {
      finishes.add(p.finish);
      if (finishes.size === 1) suggestions.push(`${p.finish} Cooktop`);
    }
  }

  // Distinct fallback list if catalog is still loading
  const combined = Array.from(new Set(suggestions)).filter(Boolean);
  if (combined.length >= 4) return combined.slice(0, 6);

  return [
    "3 Burner Gas Stove",
    "Auto Ignition Hob",
    "Filterless Chimney",
    "Toughened Glass Cooktop",
    "Built-in Hob",
  ];
}

// Autocorrect a query string based on dynamically extracted vocabulary
export function autocorrectQuery(query, dictionary = []) {
  if (!query || typeof query !== "string") {
    return { corrected: "", hasCorrection: false, original: "" };
  }

  const trimmed = query.trim().toLowerCase();

  // Check colloquial / vernacular synonyms first
  if (COLLOQUIAL_SYNONYMS[trimmed]) {
    return { corrected: COLLOQUIAL_SYNONYMS[trimmed], hasCorrection: true, original: query.trim() };
  }

  const words = trimmed.split(/\s+/);
  let changed = false;

  const correctedWords = words.map((word) => {
    // Direct colloquial replacement
    if (COLLOQUIAL_SYNONYMS[word]) {
      changed = true;
      return COLLOQUIAL_SYNONYMS[word];
    }

    // Keep numbers, product SKU parts, or very short words untouched
    if (word.length <= 2 || /^\d+$/.test(word)) return word;

    // If word already exists in the dynamic dictionary, keep as is
    if (dictionary.includes(word)) return word;

    // Fuzzy match against dynamic dictionary using Levenshtein distance
    let bestMatch = word;
    let minDistance = 99;
    const maxThreshold = word.length <= 4 ? 1 : 2;

    for (const dictWord of dictionary) {
      // Must have comparable length to avoid false positives
      if (Math.abs(dictWord.length - word.length) > maxThreshold) continue;
      const dist = levenshteinDistance(word, dictWord);
      if (dist < minDistance && dist <= maxThreshold) {
        minDistance = dist;
        bestMatch = dictWord;
      }
    }

    if (bestMatch !== word) {
      changed = true;
      return bestMatch;
    }
    return word;
  });

  const corrected = correctedWords.join(" ");
  return {
    corrected,
    hasCorrection: changed && corrected !== trimmed,
    original: query.trim(),
  };
}

// Score a product's relevance against a search query
export function scoreProduct(p, needle) {
  if (!p || !needle) return 0;
  const q = needle.toLowerCase().trim();
  const model = (p.model || "").toLowerCase();
  const name = (p.name || "").toLowerCase();
  const cat = (p.catLabel || p.cat || "").toLowerCase();
  const code = (p.code || p.sku || "").toLowerCase();
  const finish = (p.finish || "").toLowerCase();
  const features = (p.features || []).map((f) => f.toLowerCase()).join(" ");
  const brand = (p.brand || "").toLowerCase();
  const companyLegal = (COMPANY.legal || "").toLowerCase();
  const companyBrand = (COMPANY.brand || "").toLowerCase();

  // 1. Exact model match (Highest priority)
  if (model === q) return 100;
  if (model.startsWith(q)) return 85;
  if (model.includes(q)) return 70;

  // 2. Product code / SKU match
  if (code && (code === q || code.includes(q))) return 90;

  // 3. Title / Name match
  if (name.startsWith(q)) return 60;
  if (name.includes(q)) return 50;

  // 4. Category match (e.g. "gas stove", "hob", "chimney")
  if (cat.includes(q)) return 40;

  // 5. Specification / Finish / Burners match (e.g. "3 burner", "glass")
  if (finish.includes(q) || features.includes(q)) return 30;
  if (p.burners && q.includes(`${p.burners} burner`)) return 45;

  // 6. Brand & Company match (e.g. "Sunshine", "Shriji")
  if (brand.includes(q) || companyBrand.includes(q) || companyLegal.includes(q)) return 25;

  // 7. Multi-token search (matches across different fields: e.g. "sunshine 3 burner glass")
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const haystack = `${model} ${name} ${cat} ${code} ${finish} ${features} ${brand} ${companyBrand} ${companyLegal}`;
    const allMatch = tokens.every((t) => haystack.includes(t));
    if (allMatch) return 40;
    const someMatchCount = tokens.filter((t) => haystack.includes(t)).length;
    if (someMatchCount >= Math.ceil(tokens.length * 0.6)) return 20;
  }

  return 0;
}

// Search suggestions for the interactive search dropdown
export function getSuggestions(products = [], categories = [], query = "") {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return {
      products: [],
      categories: [],
      correction: null,
      popular: getPopularSearches(products, categories),
    };
  }

  // Dynamic dictionary from current live products and categories
  const dict = buildSearchDictionary(products, categories);
  const { corrected, hasCorrection } = autocorrectQuery(needle, dict);

  // Direct matches
  const directMatches = products
    .map((p) => ({ product: p, score: scoreProduct(p, needle) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);

  let finalProducts = directMatches;
  let correction = null;

  // If 0 direct matches, test against autocorrected query
  if (directMatches.length === 0 && hasCorrection) {
    const correctedMatches = products
      .map((p) => ({ product: p, score: scoreProduct(p, corrected) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.product);

    if (correctedMatches.length > 0) {
      finalProducts = correctedMatches;
      correction = corrected;
    }
  } else if (hasCorrection) {
    correction = corrected;
  }

  // Matching categories (exact or partial)
  const catMatches = categories.filter((c) =>
    (c.label || "").toLowerCase().includes(needle) || (c.key || "").toLowerCase().includes(needle)
  );

  return {
    products: finalProducts.slice(0, 6),
    categories: catMatches.slice(0, 3),
    correction,
    popular: [],
  };
}
