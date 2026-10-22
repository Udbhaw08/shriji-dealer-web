// Company facts are real, taken from shrijidomestic.com.
// Scheme figures are sample content for this pitch build and are labelled where shown.

export const COMPANY = {
  legal: "Shriji Domestic Appliances Pvt. Ltd.",
  brand: "Sunshine",
  founded: 1999,
  phone: "+91 77383 69367",
  phoneRaw: "917738369367",
  email: "contact@shrijidomestic.com",
  address: "Motilal Nagar 1, Goregaon West, Mumbai",
  tagline: "Delivering the heart of every kitchen",
  about:
    "Since 1999, Shriji Domestic has been a leading distributor of domestic kitchen appliances, specialising in gas stoves and chimneys from Sunshine India.",
};

export const NAV = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" },
  { to: "/favorites", label: "Favorites" },
  { to: "/schemes", label: "Schemes" },
  { to: "/support", label: "Support" },
];

export const STATS = [
  { value: "25+", label: "Years in business" },
  { value: "1,000+", label: "Retailers tapped" },
  { value: "4,500+", label: "Customers served monthly" },
  { value: "4,000+", label: "Products installed monthly" },
];

export const QUICK_NAV = [
  { icon: "stove", label: "Products", sub: "Full range", to: "/products" },
  { icon: "tag", label: "Schemes", sub: "Active offers", to: "/schemes" },
  { icon: "sparkle", label: "New Launches", sub: "Just in", to: "/products?sort=new" },
  { icon: "support", label: "Support", sub: "Raise a request", to: "/support" },
];

export const QUICK_ACCESS = [
  { icon: "image", title: "Marketing Material", sub: "Images, videos, brochures", to: "/support#marketing" },
  { icon: "support", title: "Service Support", sub: "Raise a service request", to: "/support" },
];

export const SCHEMES = {
  active: [],
  upcoming: [],
  past: [],
};

export const MATERIALS = [
  {
    id: "product-images",
    title: "Product Images",
    count: "24 assets",
    img: "/img/cat-gas_stoves.webp",
    tab: "Images",
    filename: "Sunshine-Product-Images-Pack.zip",
    fileSize: "48 MB",
  },
  {
    id: "ad-creatives",
    title: "Ad Creatives",
    count: "12 assets",
    img: "/img/mat-ad-scene.png",
    tab: "Images",
    filename: "Sunshine-Ad-Creatives-Pack.zip",
    fileSize: "28 MB",
  },
  {
    id: "annual-scheme-flyer",
    title: "Annual Business Scheme Poster",
    count: "Official Poster · PDF",
    img: "/img/scheme-annual-business-2026.jpg",
    tab: "Flyers",
    filename: "Sunshine-Annual-Business-Scheme-FY26-27.pdf",
    downloadUrl: "/downloads/Sunshine-Annual-Business-Scheme-FY26-27.pdf",
    fileSize: "359 KB",
  },
  {
    id: "diwali-scheme-flyer",
    title: "Diwali Scheme 2026 Poster",
    count: "Official Poster · PDF",
    img: "/img/scheme-diwali-2026.jpg",
    tab: "Flyers",
    filename: "Sunshine-Diwali-Scheme-2026.pdf",
    downloadUrl: "/downloads/Sunshine-Diwali-Scheme-2026.pdf",
    fileSize: "385 KB",
  },
  {
    id: "lifestyle-banners",
    title: "Lifestyle Banners",
    count: "18 assets",
    img: "/img/cat-chimneys.webp",
    tab: "Images",
    filename: "Sunshine-Lifestyle-Banners.zip",
    fileSize: "36 MB",
  },
  {
    id: "social-media-creatives",
    title: "Social Media Creatives",
    count: "16 assets",
    img: "/img/cat-small_appliances.webp",
    tab: "Images",
    filename: "Sunshine-Social-Media-Pack.zip",
    fileSize: "22 MB",
  },
  {
    id: "range-brochure",
    title: "Sunshine Product Catalogue 2026",
    count: "PDF · 18 MB",
    img: "/img/cat-hob_tops.webp",
    tab: "Brochures",
    filename: "Sunshine-Range-Brochure-2026.pdf",
    fileSize: "18 MB",
  },
];

export const ISSUE_TYPES = [
  "Installation support",
  "Product not working",
  "Spare part required",
  "Warranty claim",
  "Delivery or damage",
  "Other",
];
