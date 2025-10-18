# AGENTS.md - ComfyUI Extension Protocol (v3)

## 1. Scope
Defines the minimal behavioral protocol for autonomous agents (Codex / Serena / context7, etc.) to generate, validate, and maintain **ComfyUI v3 schema–compliant extensions** (Python nodes and JavaScript UI extensions) that target the current Vue/TypeScript frontend shipped via the `comfyui-frontend-package` pip distribution.

## 2. Source of Truth
Use **official ComfyUI documentation only**; do not rely on undocumented assumptions. Cross-check both the backend docs and the new frontend repo / package notes when UI APIs are involved.

- JavaScript extensions: `WEB_DIRECTORY`, auto-loading of `.js`, `app.registerExtension()` (Vue frontend compat notes)  
  https://docs.comfy.org/custom-nodes/js/javascript_overview
- Backend lifecycle: loading from `custom_nodes`, `NODE_CLASS_MAPPINGS`, optional `NODE_DISPLAY_NAME_MAPPINGS`  
  https://docs.comfy.org/custom-nodes/backend/lifecycle
- Custom node walkthrough (minimal Python + optional JS)  
  https://docs.comfy.org/custom-nodes/walkthrough
- v3 schema & migration guidance  
  https://docs.comfy.org/custom-nodes/v3_migration
- Core concepts overview for custom nodes  
  https://docs.comfy.org/development/core-concepts/custom-nodes
- Changelog (to confirm current v3 status)  
  https://docs.comfy.org/changelog

## 3. Minimal Layout

### Python Node (required)
- Location: `ComfyUI/custom_nodes/<package>/`
- `__init__.py` must export `NODE_CLASS_MAPPINGS` (and optionally `NODE_DISPLAY_NAME_MAPPINGS`)

### JavaScript Extension (optional)
- Convention: add `<package>/js/` and export `WEB_DIRECTORY = "./js"` in `__init__.py`
- Files under `<package>/js/*.js` are auto-loaded; each must call `app.registerExtension({...})`

(See the docs linked above for the exact mechanics.)

## 4. Generation Rules
- Define nodes with the **v3 schema** (`define_schema()` with explicit I/O types, category, description)
- Python: single responsibility, deterministic, no unauthorized side effects or undeclared dependencies
- JavaScript: ES6+, build-free, no external libraries, public APIs only (do not modify core or private internals). Validate compatibility against the currently installed `comfyui-frontend-package` version; avoid depending on legacy DOM structures removed in the Vue rewrite.

## 5. Workflow (Plan ↁEBuild ↁEValidate ↁETest ↁERecord)
1) **Plan**  EDescribe purpose, I/O, constraints, category in `docs/requirements/*.md`  
2) **Build**  EImplement Python node (and JS extension if needed)  
3) **Validate**  E`NODE_CLASS_MAPPINGS` present; `WEB_DIRECTORY` exported only if JS exists; schema integrity; safe imports  
4) **Test**  ELoad locally in ComfyUI; confirm JS reloads without server restart  
5) **Record**  EDocument decisions in `docs/adr/YYYY-MM-DD-*.md`

## 6. Stop Rules (escalate before proceeding)
Stop and request clarification if:
- Requirements are ambiguous or contradictory
- Behavior diverges from the official docs
- Compatibility or security risks are suspected (e.g., XSS, arbitrary code execution)
- Confidence < 0.8

Escalation format:
    Question: …
    Context: …
    Options: [A/B/…]
    Recommendation: … (Confidence: 0.xx)


## 7. Pre-Commit Checklist
- [ ] `docs/requirements/*.md` exists and is current
- [ ] `__init__.py` exports `NODE_CLASS_MAPPINGS`
- [ ] If JS is included: `WEB_DIRECTORY = "./js"` is exported
- [ ] All nodes define a valid **v3 schema**
- [ ] No unsafe imports or undeclared dependencies
- [ ] No Python exceptions or JS console errors on load
- [ ] ADR updated under `docs/adr/`
- [ ] Confidence ≥ 0.8 (attach escalation log if lower)
