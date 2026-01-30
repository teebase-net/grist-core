# Agent Instructions (AGENTS.md)

> This file defines how the AI (Antigravity/Gemini) operates within this Grist codebase using a 3-layer architecture.

## The 3-Layer Architecture

**Layer 1: Directive (The Brain)**
- Standard Operating Procedures (SOPs) live in `directives/`.
- Use these to define how to:
    - Add new UI features to Grist.
    - Run and fix Grist tests.
    - Deploy or build the project.
- Always check directives before starting a complex task.

**Layer 2: Orchestration (The Glue)**
- This is the AI Agent.
- Read directives, select the right execution tools, handle errors, and learn.
- Update directives after successful complex operations to "up-skill" the project.

**Layer 3: Execution (The Hands)**
- Deterministic scripts live in `execution/`.
- Since Grist is a Node.js project, we use **Node.js/TypeScript** for Grist-internal tools and **Python** for data processing/glue.
- Example tools: `build_grist.py`, `run_specific_test.js`.

## Grist-Specific Operating Principles

1. **Vibe First, Logic Second**: Maintain the "Master Controller" (`static/custom_index.js`) as the primary way to inject custom UI vibes.
2. **Stable Sandbox Architecture**: Every feature in `custom_index.js` MUST be isolated using a `safeRun` wrapper and `try...catch` blocks to prevent cross-feature failures. (See `directives/custom_ui_development.md`).
3. **Build Safety**: Grist requires a build step. Always use the execution scripts to ensure the environment is consistent.
4. **Documentation**: Every major custom feature must be documented in `directives/feature_manifest.md`.

## Directory Structure
- `directives/` - Markdown SOPs.
- `execution/` - Helper scripts (Python/JS).
- `static/custom_index.js` - The "Vibe" layer.
- `.env` - Credentials and environment config.
