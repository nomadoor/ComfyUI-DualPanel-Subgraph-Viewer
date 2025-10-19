# 2025-10-19  Dual Panel Resize Persistence

## Context
- Requirement `000-dual-panel-subgraph` now needs the subgraph side panel to support user-controlled widths instead of the fixed CSS-based size.
- The existing JavaScript extension already injects the panel and manages layout through the `--dual-panel-subgraph-width` CSS variable, making it a natural hook for resizing logic.
- We must keep the implementation non-invasive and compatible with the Vue/TypeScript frontend, following the documented `app.registerExtension()` workflow.

## Decision
- Introduced a dedicated resize handle (`.dual-panel-subgraph__resize-handle`) that listens for pointer events and adjusts the panel width on drag.
- Clamped panel widths between 320px and `viewport - 360px` to preserve a usable main canvas, updating the CSS variable on every change.
- Persisted the most recent width in `localStorage` under the key `dualPanel.subgraph.width.v1`, restoring it whenever the panel reopens.
- Added a temporary body class while resizing to give user feedback, suppress unwanted text selection, and disable layout transitions that caused visible gaps.
- Throttled canvas resizes with `requestAnimationFrame` during pointer moves to keep drag interactions responsive while still redrawing at the next frame.
- Added scoped CSS so that, while the body carries `dual-panel-subgraph-open`, the minimap containerとズームボタン群の `right` を `calc(var(--dual-panel-subgraph-width) + 16px)` だけ押し戻し、UI をメインキャンバス側に寄せる（JavaScript でのスタイル書き換えは廃止）。
- Considered wiring `MutationObserver` + resize listeners so newly mounted minimap/zoom widgets stay pinned, but the naive prototype caused a feedback loop: pinning adjusts inline styles -> observer fires -> repin -> layout thrashes. We postponed that approach until we can scope the observer to stable containers and temporarily pause it around our own mutations.
- Intercepted Delete/Backspace/`P` while the subgraph panel owns focus, routing those shortcuts directly to the secondary canvas and clearing the main-canvas selection up front so両キャンバスのノードが同時に削除される事故を防ぐ。

## Consequences
- Users can resize the panel freely, and their preferred width survives reloads in the same browser profile.
- The new `localStorage` key is browser-scoped; different profiles or privacy modes will not share the saved width.
- Additional pointer-event logic must be maintained alongside future LiteGraph or Vue updates, but it remains isolated within the extension.
- Frame-throttled resizing keeps the interaction smooth at the cost of slightly delayed redraws when dragging extremely quickly, which we accept as a trade-off.
- The PrimeVue toolbarとズーム UI は CSS で常にパネル幅ぶんシフトされるため、パネルの開閉・リサイズに連動して自然に位置が決まる。今後 ComfyUI 側のクラス名が変わった場合は、そのセレクタを更新する必要がある。
- Without scoped observers the pinned elements will still slide momentarily if the user toggles the minimap after the panel is open. Reintroducing observers requires the mitigations noted above to avoid another oscillation.

## Follow-up Notes
- グローバルな keybinding サービスは依然として `app.canvas` を前提としているため、将来的には Pinia ストア/commandStore を介したセカンダリキャンバス切替を検討したい。
- Any future attempt to keep minimap/zoom widgets pinned while toggling visibility should scope DOM observers to stable containers and pause them around our own mutations to avoid an infinite repin loop.
