---
trigger: always_on
description: Archify diagram folder structure and artifact generation rules.
---

# Archify Diagram Generation Protocol

When generating architecture, sequence, workflow, dataflow, or lifecycle diagrams using Archify:

## Rule 1: Dedicated Subfolder Per Diagram
Always isolate each diagram into its own distinct subfolder under `docs/archify/<diagram_name>/`:
- System Architecture: `docs/archify/system_architecture/`
- Sequence Diagram: `docs/archify/<topic>_sequence/` (e.g. `docs/archify/checkout_sequence/`)
- Workflow Diagram: `docs/archify/<topic>_workflow/`
- Dataflow / Lifecycle: `docs/archify/<topic>_<type>/`

Never place diagram artifacts directly in `docs/` root.

## Rule 2: Output Artifacts (HTML & Dark Image Only)
Every diagram folder must contain:
1. `<diagram_name>.html` — Standalone, interactive HTML diagram.
2. `<diagram_name>_dark.png` — High-resolution dark-mode rendered capture.
3. `<diagram_name>.json` — Source specification.

## Rule 3: Intermediate File Cleanup
Immediately remove all intermediate test sidecars:
- Remove light mode captures (`*.light.png`)
- Remove contact sheets (`*.visual-check.html`)
- Remove visual check JSON receipts (`*.visual-check.json`)
Keep the directory clean, containing only the HTML, dark image, and source JSON.
