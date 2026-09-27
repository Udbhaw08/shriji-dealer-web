# Master Codebase Architecture Reference

> 66 nodes · cohesion 0.11

## Key Concepts

- **geometry.mjs** (75 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **compileWorkflowInternal()** (67 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- **asArray()** (43 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **geometry.test.mjs** (34 connections) — `.agents/skills/archify/test/geometry.test.mjs`
- **validateArchitecture()** (22 connections) — `.agents/skills/archify/renderers/architecture/render-architecture.mjs`
- **validateDataflow()** (22 connections) — `.agents/skills/archify/renderers/dataflow/render-dataflow.mjs`
- **validateLifecycle()** (22 connections) — `.agents/skills/archify/renderers/lifecycle/render-lifecycle.mjs`
- **cleanCrossingProblems()** (18 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **isFinitePoint()** (18 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **cleanFlowProblems()** (17 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **rectsOverlap()** (16 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **validateSequence()** (15 connections) — `.agents/skills/archify/renderers/sequence/render-sequence.mjs`
- **cleanAmbiguousCorridorProblems()** (15 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **cleanBorderRunProblems()** (15 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **cleanRouteRhythmProblems()** (15 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **labelPoint()** (15 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **cleanEndpointSideProblems()** (14 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **cleanLabelRouteClearanceProblems()** (14 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **brandTopRailProblem()** (13 connections) — `.agents/skills/archify/renderers/shared/brand-marks.mjs`
- **collectLabelRouteClearance()** (12 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **segmentIntersectsRect()** (12 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **suggestLabelObstacleFix()** (12 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **availableNodeTextWidth()** (11 connections) — `.agents/skills/archify/renderers/shared/text-fit.mjs`
- **collectBorderRuns()** (10 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- **normalizeRoutePoints()** (10 connections) — `.agents/skills/archify/renderers/shared/geometry.mjs`
- *... and 41 more nodes in this community*

## Relationships

- [[Community 34]] (55 shared connections)
- [[Live Pricing Audit Tool]] (46 shared connections)
- [[Community 39]] (38 shared connections)
- [[Pricing Regression Test Suite]] (35 shared connections)
- [[Community 40]] (26 shared connections)
- [[Product Pages Specification]] (16 shared connections)
- [[Architecture Doc Generator]] (6 shared connections)
- [[Community 168]] (3 shared connections)
- [[Agent Guidelines (AGENTS.md)]] (1 shared connections)

## Source Files

- `.agents/skills/archify/renderers/architecture/render-architecture.mjs`
- `.agents/skills/archify/renderers/dataflow/render-dataflow.mjs`
- `.agents/skills/archify/renderers/lifecycle/render-lifecycle.mjs`
- `.agents/skills/archify/renderers/sequence/render-sequence.mjs`
- `.agents/skills/archify/renderers/shared/brand-marks.mjs`
- `.agents/skills/archify/renderers/shared/diagnostics.mjs`
- `.agents/skills/archify/renderers/shared/geometry.mjs`
- `.agents/skills/archify/renderers/shared/text-fit.mjs`
- `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- `.agents/skills/archify/test/geometry.test.mjs`

## Audit Trail

- EXTRACTED: 690 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*