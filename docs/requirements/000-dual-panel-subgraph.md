# Feature Requirements: DualPanel Subgraph Viewer

**ID:** `000-dual-panel-subgraph`  
**Status:** Draft  
**Updated:** 2025-10-18  

---

## 1. Purpose
Enable users to open and edit **Subgraph** nodes in a secondary side panel whenever a subgraph is expanded (triggered by **double-clicking the node** or **clicking its expand icon**) without touching ComfyUI core frontend files. The implementation must stay compatible with the Vue/TypeScript frontend shipped via the `comfyui-frontend-package` pip distribution (verify baseline version during implementation).

---

## 2. Goals
- Display the subgraph editor on the right side of the screen (dual-panel layout).  
- Support both expansion triggers:  
  - Node double-click.  
  - Click on the Subgraph expand icon (ComfyUI's built-in expand control).  
- Allow full node interaction (pan, zoom, connect, delete, add) within the side panel.  
- Maintain correct focus switching between main and subgraph canvases.  
- Cleanly remove the panel and restore state on close.  
- Implement entirely as a **non-invasive** JS extension with a minimal Python stub, targeting the modern Vue frontend.

---

## 3. UI Concept

- Right half: displays subgraph content in a secondary `LGraphCanvas`.  
- Left half: remains the main workflow canvas.  
- Only one panel may be open at a time (v1 limitation).

---

## 4. Basic Behavior

### Open
- **Triggers:**  
  - Double-click a Subgraph node  
  - Click the node's expand icon  
- **Action:**  
  - Create a right-side panel with a new `LGraphCanvas` rendering `node.subgraph`  
  - Keep the main canvas visible and interactive  

### Edit
- Inside the panel: pan, zoom, move, connect, delete, and add nodes.  
- `LiteGraph.active_canvas` switches automatically on mouse enter/leave.  

### Close
- Triggered by a close button, Escape key, or second double-click/icon click.  
- Destroys the panel, clears canvas, removes event listeners, and restores main focus.

---

## 5. Implementation Notes

### Python (`__init__.py`)
```
WEB_DIRECTORY = "./js"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
JavaScript (js/dual_panel.js)
Register via app.registerExtension("DualPanel.SubgraphViewer").
```

- Integrate with the Vue-based workflow navigation (for example, patch `LGraphCanvas.openSubgraph` or use documented services) instead of relying on legacy DOM double-click listeners, because the Vue wrapper consumes those events.
- Create and destroy a div panel containing an independent `LGraphCanvas`.
- Handle cleanup and focus management safely.
- Document any minimum `comfyui-frontend-package` (Vue frontend) version in the ADR when new APIs are required.
- Avoid touching packaged frontend assets; ship changes solely through the extension auto-loader.

## 6. Edge Cases
- Node lacks subgraph -> log warning, do nothing.
- Opening a new panel closes any existing one.
- Handle resize, rapid toggling, and LiteGraph version mismatches gracefully.

## 7. Acceptance Criteria

- Subgraph opens via double-click or expand icon.
- User can edit nodes normally inside the side panel.
- Focus switching works (main <-> panel).
- Panel closes cleanly, no memory leaks or console errors.
- Works on latest Chrome, Firefox, Edge.
