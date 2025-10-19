# 2025-10-18 — Dual Panel Subgraph Viewer

## Context
- Requirement `000-dual-panel-subgraph` mandates a non-invasive JavaScript extension that opens subgraphs in a secondary panel while leaving the primary ComfyUI canvas usable.
- Official ComfyUI guidance for custom nodes (backend lifecycle) and JavaScript extensions requires exporting `NODE_CLASS_MAPPINGS` and `WEB_DIRECTORY` from `__init__.py`, with frontend logic loaded from `js/*.js`.
- The feature must work without altering core ComfyUI files and should gracefully handle focus, cleanup, and the absence of a subgraph.

## Decision
- Provide a Python stub (`__init__.py`) that exposes `WEB_DIRECTORY = "./js"` and deliberately leaves `NODE_CLASS_MAPPINGS` empty because all functionality lives in the frontend.
- Implement `js/dual_panel_subgraph.js` as an `app.registerExtension` module that:
  - Injects minimal CSS for a fixed right-side panel while keeping the main canvas interactive.
  - Wraps `LiteGraph.Subgraph` double-click and expand behaviors to toggle the secondary panel instead of navigating away.
  - Creates a dedicated `LGraphCanvas` bound to the node’s `subgraph`, with resize handling, focus switching, and cleanup on close or node removal.
- Add Escape-key, header button, and repeated trigger handling to close the panel and restore the main canvas state.

## Consequences
- No backend node schema is exposed yet; future Python nodes can be added without changing the JS extension contract.
- Overlay approach avoids DOM restructuring but relies on LiteGraph APIs remaining stable; if ComfyUI updates those APIs we may need to revisit the wrappers.
- The extension assumes the browser supports `ResizeObserver`; for older browsers we would need a polyfill or fallback.

## Verification & Iterations (2025-10-18)
- **Vue frontend integration:** Reworked the extension to import `{ app }` from the packaged frontend and patch `LGraphCanvas.openSubgraph` rather than relying on legacy DOM double-click handlers. This resolved the `ReferenceError: app is not defined` thrown when the new Vue UI attempted to load the script.
- **Canvas bootstrap stability:** Initial attempts to instantiate `LGraphCanvas` with the subgraph object triggered `dispatchEvent` errors when ComfyUI reused canvas elements. Updated the panel creation flow to create an empty canvas, call `setGraph(subgraph)`, and start rendering explicitly.
- **DOM host tracking:** Opening additional workflow tabs replaced the underlying canvas container, causing stale padding classes and layout breakage. `ensureMainHosts()` now validates cached host elements with `isConnected`, resets stale references, and rebuilds the host list from the current canvas hierarchy.
- **Event listener cleanup:** Touch focus handlers were previously registered with `{ passive: true }` but removed without matching options. Matching add/remove signatures prevents leaked listeners on Safari/iOS.
- **Bug fix regressions:** A regressions introduced while refreshing the host calculation referenced an undefined `canvasElement`, preventing the panel from opening. Restored correct usage of `currentCanvas.parentElement`, eliminating the runtime `ReferenceError`.
- **Observed backend 404s:** The Vue frontend logs `api/userdata/...` 404s when optional user assets (templates, CSS) are absent. These are expected in a clean setup and unrelated to the extension; documented here to avoid misattributing them to the panel logic.

- **Open issue (2025-10-18): Subgraph panel cannot host DOM-based widgets (e.g. CLIP Text Encode multiline prompt).** 
  ComfyUI renders multiline prompts as DOM widgets (`addDOMWidget`) via a separate Vue+Pinia layer tied to the main canvas. Our dual-panel canvas does not participate in that lifecycle, so the widgets are not promoted/visible and user input is impossible without a deeper frontend change. Until the upstream DOM widget layer supports multiple canvases, we treat multiline prompts as read-only inside the panel.
- **Open issue (2025-10-18): Node toolbars are missing inside the subgraph panel.**
  The Vue toolbar overlay relies on `useCanvasStore()` (Pinia) watching the active canvas; our secondary `LGraphCanvas` is not registered with that store, so the overlay never renders. Enabling it would require upstream support for multiple canvases inside the front-end store.

- **Open issue (2025-10-18): Node toolbars are missing inside the subgraph panel.**
  The Vue toolbar overlay relies on `useCanvasStore()` (Pinia) watching the active canvas; our secondary LGraphCanvas is not registered with that store, so the overlay never renders. Enabling it would require upstream support for multiple canvases inside the front-end store.
