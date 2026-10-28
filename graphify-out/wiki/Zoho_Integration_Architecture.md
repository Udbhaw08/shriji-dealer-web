# Zoho Integration Architecture

> 57 nodes · cohesion 0.07

## Key Concepts

- **workflow-compiler.mjs** (102 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- **workflow-migration.test.mjs** (22 connections) — `.agents/skills/archify/test/workflow-migration.test.mjs`
- **workflow-v2.mjs** (21 connections) — `.agents/skills/archify/migrations/workflow-v2.mjs`
- **migrateWorkflowDocument()** (15 connections) — `.agents/skills/archify/migrations/workflow-v2.mjs`
- **compileWorkflow()** (13 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- **createReadableLayout()** (12 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- **workflow-migration-geometry.mjs** (10 connections) — `.agents/skills/archify/renderers/workflow/workflow-migration-geometry.mjs`
- **createMappedWorkflowCandidate()** (9 connections) — `.agents/skills/archify/renderers/workflow/workflow-migration-geometry.mjs`
- **intrinsicWorkflow()** (8 connections) — `.agents/skills/archify/renderers/workflow/workflow-migration-geometry.mjs`
- **planningWorkflow()** (7 connections) — `.agents/skills/archify/renderers/workflow/workflow-migration-geometry.mjs`
- **readableGroupBounds()** (5 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- **clone()** (4 connections) — `.agents/skills/archify/migrations/workflow-v2.mjs`
- **legacyLayoutProbe()** (4 connections) — `.agents/skills/archify/migrations/workflow-v2.mjs`
- **legacyRequirementProbe()** (4 connections) — `.agents/skills/archify/migrations/workflow-v2.mjs`
- **authoredNodeWidth()** (4 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- **compileWorkflowWithFeedback()** (4 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- **createHorizontalRankMapper()** (4 connections) — `.agents/skills/archify/renderers/workflow/workflow-migration-geometry.mjs`
- **expandableViewBox()** (3 connections) — `.agents/skills/archify/migrations/workflow-v2.mjs`
- **requiredViewBoxFrom()** (3 connections) — `.agents/skills/archify/migrations/workflow-v2.mjs`
- **schemaDiagnostics()** (3 connections) — `.agents/skills/archify/migrations/workflow-v2.mjs`
- **workflow-semantic-contract.test.mjs** (3 connections) — `.agents/skills/archify/test/workflow-semantic-contract.test.mjs`
- **authoredNodeHeight()** (3 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- **compilerFailure()** (3 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- **feedbackFailure()** (3 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- **nodeWidthContributor()** (3 connections) — `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- *... and 32 more nodes in this community*

## Relationships

- [[Product Requirements Documentation]] (31 shared connections)
- [[Graphify Agent Rules]] (17 shared connections)
- [[Roles & Customer Sharing Spec]] (16 shared connections)
- [[Zoho Backend & Proxy Endpoints]] (14 shared connections)
- [[Community 41]] (9 shared connections)
- [[Community 48]] (3 shared connections)
- [[Community 149]] (3 shared connections)
- [[Community 58]] (3 shared connections)
- [[Project Readme & Layout]] (1 shared connections)
- [[Product Brand & Business Vision]] (1 shared connections)
- [[Community 54]] (1 shared connections)

## Source Files

- `.agents/skills/archify/migrations/workflow-v2.mjs`
- `.agents/skills/archify/renderers/workflow/workflow-compiler.mjs`
- `.agents/skills/archify/renderers/workflow/workflow-migration-geometry.mjs`
- `.agents/skills/archify/test/workflow-migration.test.mjs`
- `.agents/skills/archify/test/workflow-semantic-contract.test.mjs`

## Audit Trail

- EXTRACTED: 318 (99%)
- INFERRED: 3 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*