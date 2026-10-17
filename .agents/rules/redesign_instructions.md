---
trigger: always_on
description: Mandatory dual-skill consultation (refero-design + swiftui-pro) for website and mobile app redesigns.
---

# Dual-Skill Redesign & Cross-Platform UI Protocol

Whenever designing, redesigning, styling, or updating any webpage, mobile screen, or UI component:

## Rule 1: Mandatory Dual-Skill Consultation
Always visit and synthesize both skills before implementing UI changes:
1. **`refero-design`** (`.agents/skills/refero-design/`): Primary visual authority — color harmony, type hierarchy, surface elevations, micro-animations, and anti-AI-slop.
2. **`swiftui-pro`** (`.agents/skills/swiftui-pro/`): Mobile app UX & ergonomics authority — Apple HIG standards, touch target sizing (≥44pt/48px), safe areas, fluid resizing, and gesture ergonomics.

## Rule 2: Adaptive Multi-Device Responsiveness
Desktop and mobile applications must provide tailored ergonomics rather than awkward scaling:
- **Tables on Mobile**: Swap wide multi-column tables for touch-friendly expandable cards.
- **Sidebars on Mobile**: Swap dense desktop filter sidebars for slide-up bottom sheets with filter chips.
- **Navigation on Mobile**: Use thumb-accessible bottom tab bars or modal sheets instead of cramped top navigation.
- **Tooltips on Touch**: Replace hover tooltips with explicit tap triggers or contextual bottom sheets.
- **Safe Areas**: Use `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` to respect iOS notches and Android bars.
- **Zero Zoom-out**: Enforce `overflow-x: clip;` and `min-width: 0;` on all layout children.

## Rule 3: Merge for Better Results
Never design desktop in isolation from mobile, or mobile in isolation from desktop. Use the merge of both skills to produce an experience that feels like a native desktop web app on Windows/macOS and a polished native app on iOS/Android (Capacitor).

See [instructions.md](file:///c:/Users/udbha/Desktop/Webstore/instructions.md) for complete specification.
