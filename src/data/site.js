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
  tagline: "Better Products. Stronger Partners. Brighter Homes.",
  about:
    "Since 1999, Shriji Domestic has been a leading distributor of domestic kitchen appliances, specialising in gas stoves and chimneys from Sunshine India.",
};

export const NAV = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" },
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
  { icon: "doc", title: "Price List", sub: "View latest dealer pricing", to: "/schemes#pricing" },
  { icon: "image", title: "Marketing Material", sub: "Images, videos, brochures", to: "/support#marketing" },
  { icon: "support", title: "Service Support", sub: "Raise a service request", to: "/support" },
];

export const SCHEMES = {
  active: [
    {
      id: "summer",
      title: "Coolest Summer Offer",
      when: "1 May – 20 May 2026",
      blurb: "More Value. Happier Homes.",
      items: [
        { name: "Nutri Vita Pro Blender", price: "₹499" },
        { name: "Air Fryer", price: "₹899" },
        { name: "Electric Kettle", price: "₹999" },
      ],
      details: [
        "Valid from 1st May to 20th May 2026",
        "Applicable on select models",
        "Valid for all registered dealers",
        "Terms & conditions apply",
      ],
    },
    {
      id: "chimney",
      title: "Chimney Upgrade Drive",
      when: "1 May – 30 June 2026",
      blurb: "BLDC range, dealer margin extended.",
      items: [
        { name: "60 Dijon BLDC", price: "Extra 4%" },
        { name: "90 Casavo BLDC", price: "Extra 4%" },
        { name: "60 Anton Plus Max BLDC", price: "Extra 3%" },
      ],
      details: [
        "Applicable on BLDC chimneys only",
        "Minimum order of 5 units",
        "Margin credited on the following invoice",
        "Terms & conditions apply",
      ],
    },
  ],
  upcoming: [
    {
      id: "monsoon",
      title: "Monsoon Counter Push",
      when: "1 July – 31 July 2026",
      blurb: "Hob tops and auto-ignition stoves.",
      items: [
        { name: "3B Carnival Plus Auto", price: "Announced 25 Jun" },
        { name: "4B Shine BK Auto", price: "Announced 25 Jun" },
      ],
      details: ["Scheme sheet releases 25th June 2026", "Registered dealers are notified first"],
    },
  ],
  past: [
    {
      id: "diwali",
      title: "Diwali Dhamaka 2025",
      when: "10 Oct – 5 Nov 2025",
      blurb: "Closed. Settlement complete.",
      items: [{ name: "All categories", price: "Closed" }],
      details: ["Scheme closed on 5th November 2025", "Claims settled in the December cycle"],
    },
  ],
};

export const MATERIALS = [
  { title: "Lifestyle Images", count: "12 items", img: "/img/cat-chimneys.webp", tab: "Images" },
  { title: "Product Images", count: "42 items", img: "/img/cat-gas_stoves.webp", tab: "Images" },
  { title: "Ad Creatives", count: "18 items", img: "/img/cat-hob_tops.webp", tab: "Images" },
  { title: "Social Media", count: "24 items", img: "/img/cat-hobs.webp", tab: "Images" },
  { title: "Product Films", count: "8 items", img: "/img/cat-small_appliances.webp", tab: "Videos" },
  { title: "Installation Guides", count: "6 items", img: "/img/cat-hobs.webp", tab: "Videos" },
  { title: "Range Brochure 2026", count: "PDF · 18 MB", img: "/img/cat-gas_stoves.webp", tab: "Brochures" },
  { title: "Chimney Catalogue", count: "PDF · 11 MB", img: "/img/cat-chimneys.webp", tab: "Brochures" },
];

export const ISSUE_TYPES = [
  "Installation support",
  "Product not working",
  "Spare part required",
  "Warranty claim",
  "Delivery or damage",
  "Other",
];
