import { app } from "../../scripts/app.js";

console.info("[DualPanel] Module loaded");

app.registerExtension({
    name: "DualPanel.SubgraphViewer",
    async setup(app) {
        console.info("[DualPanel] setup() called");
        const STYLE_ID = "dual-panel-subgraph-style";
        const BODY_CLASS = "dual-panel-subgraph-open";
        const BODY_RESIZING_CLASS = "dual-panel-subgraph-resizing";
        const HOST_CLASS = "dual-panel-main-host";
        const PANEL_CLASS = "dual-panel-subgraph";
        const WIDTH_STORAGE_KEY = "dualPanel.subgraph.width.v1";
        const MIN_PANEL_WIDTH = 320;
        const MIN_MAIN_WIDTH = 360;
        installStyle();

        const state = {
            panel: null,
            node: null,
            graphCanvas: null,
            disposers: [],
            mainHosts: [],
            panelHasFocus: false,
            rootCanvas: null,
        };

        registerShortcutHandlers();

        function installStyle() {
            if (document.getElementById(STYLE_ID)) {
                return;
            }
            const style = document.createElement("style");
            style.id = STYLE_ID;
            style.textContent = `
                :root {
                    --dual-panel-subgraph-width: min(50vw, 680px);
                    --dual-panel-top-offset: 0px;
                }

                body.${BODY_CLASS} {
                    overflow: hidden;
                }

                body.${BODY_RESIZING_CLASS} {
                    cursor: ew-resize;
                    user-select: none;
                }

                .${PANEL_CLASS} {
                    position: fixed;
                    top: var(--dual-panel-top-offset, 0px);
                    right: 0;
                    width: var(--dual-panel-subgraph-width);
                    height: calc(100vh - var(--dual-panel-top-offset, 0px));
                    display: flex;
                    flex-direction: column;
                    background: var(--comfy-menu-bg, #1b1b1f);
                    border-left: 1px solid rgba(255, 255, 255, 0.12);
                    box-shadow: -24px 0 64px -48px rgba(0, 0, 0, 0.8);
                    z-index: 64;
                    transform: translateZ(0);
                    will-change: width;
                }

                .dual-panel-subgraph__header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 16px;
                    gap: 12px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
                    background: rgba(0, 0, 0, 0.35);
                    font-size: 13px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .dual-panel-subgraph__title {
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .dual-panel-subgraph__close {
                    appearance: none;
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    border-radius: 4px;
                    padding: 4px 10px;
                    font-size: 12px;
                    background: rgba(255, 255, 255, 0.08);
                    color: inherit;
                    cursor: pointer;
                    transition: background 120ms ease, border-color 120ms ease;
                }

                .dual-panel-subgraph__resize-handle {
                    position: absolute;
                    top: 0;
                    left: -8px;
                    width: 16px;
                    height: 100%;
                    cursor: ew-resize;
                    z-index: 65;
                }

                .dual-panel-subgraph__close:hover {
                    background: rgba(255, 255, 255, 0.18);
                    border-color: rgba(255, 255, 255, 0.32);
                }

                .dual-panel-subgraph__canvas {
                    flex: 1;
                    height: calc(100vh - var(--dual-panel-top-offset, 0px));
                    position: relative;
                    overflow: hidden;
                    background: var(--comfy-menu-bg, #1b1b1f);
                }

                .dual-panel-subgraph__canvas canvas {
                    width: 100%;
                    height: 100%;
                    display: block;
                }

                body.${BODY_CLASS} .${HOST_CLASS} {
                    box-sizing: border-box;
                    width: calc(100% - var(--dual-panel-subgraph-width));
                    max-width: calc(100% - var(--dual-panel-subgraph-width));
                    transition: width 140ms ease, max-width 140ms ease;
                }

                body.${BODY_RESIZING_CLASS} .${PANEL_CLASS},
                body.${BODY_RESIZING_CLASS} .${HOST_CLASS} {
                    transition: none !important;
                }

                body.${BODY_CLASS} .minimap-main-container,
                body.${BODY_CLASS} .p-buttongroup.p-component.p-buttongroup-vertical,
                body.${BODY_CLASS} .w-\\[250px\\].z-1300 {
                    position: fixed !important;
                    left: auto !important;
                }

                body.${BODY_CLASS} .minimap-main-container {
                    bottom: 66px !important;
                    right: 0.5rem !important;
                }

                body.${BODY_CLASS} .p-buttongroup.p-component.p-buttongroup-vertical {
                    bottom: 1rem !important;
                    right: 0.5rem !important;
                }

                body.${BODY_CLASS} .w-\\[250px\\].z-1300 {
                    bottom: 66px !important;
                    right: 0.5rem !important;
                }

                @media (min-width: 768px) {
                    body.${BODY_CLASS} .minimap-main-container,
                    body.${BODY_CLASS} .p-buttongroup.p-component.p-buttongroup-vertical,
                    body.${BODY_CLASS} .w-\\[250px\\].z-1300 {
                        right: 2.75rem !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        function clampPanelWidth(width) {
            const viewportWidth = Math.max(window.innerWidth || document.documentElement.clientWidth || 0, MIN_PANEL_WIDTH);
            const maxWidth = Math.max(MIN_PANEL_WIDTH, viewportWidth - MIN_MAIN_WIDTH);
            const safeWidth = Math.min(Math.max(width, MIN_PANEL_WIDTH), Math.max(MIN_PANEL_WIDTH, maxWidth));
            return Math.round(safeWidth);
        }

        function loadStoredPanelWidth() {
            try {
                const raw = window.localStorage?.getItem(WIDTH_STORAGE_KEY);
                if (!raw) {
                    return null;
                }
                const parsed = Number.parseInt(raw, 10);
                if (Number.isFinite(parsed)) {
                    return clampPanelWidth(parsed);
                }
            } catch (error) {
                console.warn("[DualPanel] Failed to load stored panel width", error);
            }
            return null;
        }

        function persistPanelWidth(width) {
            try {
                window.localStorage?.setItem(WIDTH_STORAGE_KEY, String(clampPanelWidth(width)));
            } catch (error) {
                console.warn("[DualPanel] Failed to persist panel width", error);
            }
        }

        function setPanelWidth(width, { panel, canvasHost, canvas, graphCanvas, persist = false } = {}) {
            if (!panel) {
                return;
            }
            const rounded = clampPanelWidth(width);
            const widthPx = `${rounded}px`;
            panel.style.width = widthPx;
            document.documentElement.style.setProperty("--dual-panel-subgraph-width", widthPx);
            updatePanelOffset(panel, canvasHost);
            if (canvas && graphCanvas) {
                handleResize(canvas, graphCanvas);
            }
            if (persist) {
                persistPanelWidth(rounded);
            }
        }

        function shouldIgnoreKeyEventTarget(target) {
            if (!(target instanceof Element)) {
                return false;
            }
            const tagName = target.tagName?.toLowerCase();
            if (tagName === "input" || tagName === "textarea") {
                return true;
            }
            if (target.hasAttribute("contenteditable")) {
                return true;
            }
            return Boolean(target.closest("[data-dual-panel-ignore-shortcuts]"));
        }

        function clearCanvasSelection(canvas) {
            if (!canvas) {
                return;
            }
            if (typeof canvas.deselectAll === "function") {
                try {
                    canvas.deselectAll();
                } catch (error) {
                    console.warn("[DualPanel] Failed to deselect canvas items", error);
                }
            }
            if (canvas.selectedItems?.clear) {
                canvas.selectedItems.clear();
            }
            if (Array.isArray(canvas.selected_nodes_list)) {
                canvas.selected_nodes_list.length = 0;
            }
            if (canvas.selected_nodes) {
                Object.keys(canvas.selected_nodes).forEach((key) => {
                    delete canvas.selected_nodes[key];
                });
            }
            canvas.selected_node = null;
            if (Array.isArray(canvas.selected_group_list)) {
                canvas.selected_group_list.length = 0;
            }
            canvas.selected_group = null;
            if (canvas.selected_link) {
                canvas.selected_link = null;
            }
        }

        function getSelectedNodes(canvas) {
            const nodes = [];
            if (!canvas) {
                return nodes;
            }
            if (canvas.selected_nodes) {
                Object.keys(canvas.selected_nodes).forEach((key) => {
                    const node = canvas.selected_nodes[key];
                    if (node && !nodes.includes(node)) {
                        nodes.push(node);
                    }
                });
            }
            if (Array.isArray(canvas.selected_nodes_list)) {
                canvas.selected_nodes_list.forEach((node) => {
                    if (node && !nodes.includes(node)) {
                        nodes.push(node);
                    }
                });
            }
            return nodes;
        }

        function subgraphHasSelection() {
            const canvas = state.graphCanvas;
            if (!canvas) {
                return false;
            }
            if (canvas.selectedItems?.size) {
                return true;
            }
            if (canvas.selected_group || canvas.selected_link) {
                return true;
            }
            return getSelectedNodes(canvas).length > 0;
        }

        function handleSubgraphDelete() {
            const canvas = state.graphCanvas;
            if (!canvas || !subgraphHasSelection()) {
                return false;
            }
            if (typeof canvas.deleteSelected === "function") {
                try {
                    canvas.deleteSelected();
                    canvas.draw?.(true, true);
                    return true;
                } catch (error) {
                    console.warn("[DualPanel] Failed to delete subgraph selection", error);
                }
            }
            return false;
        }

        function handleSubgraphPinToggle() {
            const canvas = state.graphCanvas;
            if (!canvas) {
                return false;
            }
            const nodes = getSelectedNodes(canvas);
            if (!nodes.length) {
                return false;
            }
            let toggled = false;
            nodes.forEach((node) => {
                if (typeof node.pin === "function") {
                    try {
                        node.pin(!node.pinned);
                        toggled = true;
                    } catch (error) {
                        console.warn("[DualPanel] Failed to toggle pin on node", error);
                    }
                }
            });
            if (toggled) {
                canvas.draw?.(true, true);
            }
            return toggled;
        }

        function registerShortcutHandlers() {
            const handler = (event) => {
                if (!state.panelHasFocus || !state.graphCanvas) {
                    return;
                }
                if (shouldIgnoreKeyEventTarget(event.target)) {
                    return;
                }
                const code = event.code;
                if (code === "Delete" || code === "Backspace") {
                    if (handleSubgraphDelete()) {
                        event.preventDefault();
                        event.stopImmediatePropagation?.();
                        event.stopPropagation();
                    }
                    return;
                }
                if (event.ctrlKey || event.metaKey || event.altKey) {
                    return;
                }
                if (code === "KeyP") {
                    if (handleSubgraphPinToggle()) {
                        event.preventDefault();
                        event.stopImmediatePropagation?.();
                        event.stopPropagation();
                    }
                }
            };
            window.addEventListener("keydown", handler, { capture: true });
            state.disposers.push(() => window.removeEventListener("keydown", handler, { capture: true }));
        }

        function setupPanelResizer(panel, canvasHost, canvas, graphCanvas, resizeHandle) {
            if (!panel || !resizeHandle) {
                return;
            }

            let resizeRafId = null;

            const scheduleCanvasResize = () => {
                if (!canvas || !graphCanvas) {
                    return;
                }
                if (resizeRafId !== null) {
                    return;
                }
                resizeRafId = window.requestAnimationFrame(() => {
                    resizeRafId = null;
                    handleResize(canvas, graphCanvas);
                });
            };

            const pointerDown = (event) => {
                const isPrimaryPointer = event.button === 0 || event.pointerType === "touch" || event.pointerType === "pen";
                if (!isPrimaryPointer) {
                    return;
                }
                event.preventDefault();

                const updateFromClientX = (clientX) => {
                    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || panel.getBoundingClientRect().right;
                    const desiredWidth = viewportWidth - clientX;
                    setPanelWidth(desiredWidth, { panel, canvasHost });
                    scheduleCanvasResize();
                };

                const releasePointer = (releaseEvent) => {
                    if (releaseEvent.pointerId !== event.pointerId) {
                        return;
                    }
                    resizeHandle.releasePointerCapture?.(event.pointerId);
                    resizeHandle.removeEventListener("pointermove", handlePointerMove);
                    resizeHandle.removeEventListener("pointerup", releasePointer);
                    resizeHandle.removeEventListener("pointercancel", releasePointer);
                    document.body.classList.remove(BODY_RESIZING_CLASS);
                    if (resizeRafId !== null) {
                        window.cancelAnimationFrame(resizeRafId);
                        resizeRafId = null;
                    }
                    const finalWidth = panel.getBoundingClientRect().width;
                    setPanelWidth(finalWidth, { panel, canvasHost, canvas, graphCanvas, persist: true });
                };

                const handlePointerMove = (moveEvent) => {
                    if (moveEvent.pointerId !== event.pointerId) {
                        return;
                    }
                    moveEvent.preventDefault();
                    updateFromClientX(moveEvent.clientX);
                };

                resizeHandle.setPointerCapture?.(event.pointerId);
                document.body.classList.add(BODY_RESIZING_CLASS);
                updateFromClientX(event.clientX);

                resizeHandle.addEventListener("pointermove", handlePointerMove);
                resizeHandle.addEventListener("pointerup", releasePointer);
                resizeHandle.addEventListener("pointercancel", releasePointer);
            };

            resizeHandle.addEventListener("pointerdown", pointerDown);
            state.disposers.push(() => {
                document.body.classList.remove(BODY_RESIZING_CLASS);
                if (resizeRafId !== null) {
                    window.cancelAnimationFrame(resizeRafId);
                    resizeRafId = null;
                }
                resizeHandle.removeEventListener("pointerdown", pointerDown);
            });
        }

        function getMainCanvasElement() {
            return app.canvas?.canvas ?? document.querySelector("#graph-canvas canvas");
        }

        function ensureMainHosts() {
            const currentCanvas = getMainCanvasElement();
            if (!currentCanvas) {
                return;
            }
            const host = currentCanvas.parentElement;
            if (!host) {
                return;
            }
            if (
                state.mainHosts.length === 1 &&
                state.mainHosts[0] === host &&
                host.classList.contains(HOST_CLASS)
            ) {
                return;
            }
            resetMainHosts();
            host.classList.add(HOST_CLASS);
            state.mainHosts = [host];
        }

        function resetMainHosts() {
            state.mainHosts.forEach((element) => {
                element.classList.remove(HOST_CLASS);
            });
            state.mainHosts = [];
        }

        function disposeListeners() {
            while (state.disposers.length) {
                const dispose = state.disposers.pop();
                try {
                    dispose();
                } catch (error) {
                    console.warn("[DualPanel] Failed to dispose resource", error);
                }
            }
        }

        function focusMainCanvas() {
            state.panelHasFocus = false;
            const root = app.canvas ?? state.rootCanvas;
            if (root && LiteGraph.active_canvas !== root) {
                LiteGraph.active_canvas = root;
            }
        }

        function closePanel(reason = "manual") {
            if (!state.panel) {
                return;
            }

            disposeListeners();
            document.body.classList.remove(BODY_RESIZING_CLASS);

            if (state.graphCanvas?.graph) {
                try {
                    state.graphCanvas.graph.detachCanvas(state.graphCanvas);
                } catch (error) {
                    console.warn("[DualPanel] Failed to detach subgraph canvas", error);
                }
            }

            state.graphCanvas?.stopRendering?.();

            if (state.graphCanvas?.destroy) {
                try {
                    state.graphCanvas.destroy();
                } catch (error) {
                    console.warn("[DualPanel] Failed to destroy subgraph canvas", error);
                }
            }

            state.graphCanvas = null;
            state.node = null;

            document.body.classList.remove(BODY_CLASS);
            document.documentElement.style.removeProperty("--dual-panel-subgraph-width");
            document.documentElement.style.removeProperty("--dual-panel-top-offset");

            state.panel.remove();
            state.panel = null;
            state.panelHasFocus = false;
            state.rootCanvas = null;

            resetMainHosts();
            focusMainCanvas();

            console.debug(`[DualPanel] Panel closed (${reason})`);
        }

        function handleResize(canvasElement, graphCanvas) {
            if (!canvasElement || !graphCanvas) {
                return;
            }
            const parent = canvasElement.parentElement || canvasElement;
            const rect = parent.getBoundingClientRect();
            const devicePixelRatio = window.devicePixelRatio || 1;
            canvasElement.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
            canvasElement.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
            graphCanvas.resize();
            graphCanvas.draw(true, true);
        }

        function attachFocusHandlers(canvasElement, graphCanvas) {
            if (!canvasElement || !graphCanvas) {
                return;
            }
            const focusSubgraph = () => {
                state.panelHasFocus = true;
                if (!state.rootCanvas) {
                    state.rootCanvas = app.canvas ?? null;
                }
                if (state.rootCanvas && state.rootCanvas !== graphCanvas) {
                    clearCanvasSelection(state.rootCanvas);
                    state.rootCanvas.draw?.(true, true);
                }
                if (LiteGraph.active_canvas !== graphCanvas) {
                    LiteGraph.active_canvas = graphCanvas;
                }
            };
            const focusRoot = () => {
                state.panelHasFocus = false;
                focusMainCanvas();
            };

            canvasElement.addEventListener("mouseenter", focusSubgraph);
            canvasElement.addEventListener("mousedown", focusSubgraph);
            const touchOptions = { passive: true };
            canvasElement.addEventListener("touchstart", focusSubgraph, touchOptions);

            const mainCanvas = getMainCanvasElement();
            if (mainCanvas) {
                mainCanvas.addEventListener("mouseenter", focusRoot);
                state.disposers.push(() => mainCanvas.removeEventListener("mouseenter", focusRoot));
            }

            state.disposers.push(() => {
                canvasElement.removeEventListener("mouseenter", focusSubgraph);
                canvasElement.removeEventListener("mousedown", focusSubgraph);
                canvasElement.removeEventListener("touchstart", focusSubgraph, touchOptions);
                canvasElement.removeEventListener("mouseleave", handleMouseLeave);
            });

            function handleMouseLeave() {
                state.panelHasFocus = false;
            }
            canvasElement.addEventListener("mouseleave", handleMouseLeave);
        }

        function registerEscapeListener() {
            const handler = (event) => {
                if (event.key === "Escape") {
                    closePanel("escape");
                }
            };
            window.addEventListener("keydown", handler, { capture: true });
            state.disposers.push(() => window.removeEventListener("keydown", handler, { capture: true }));
        }

        function registerGraphRemovalWatcher(node) {
            const graph = node?.graph;
            if (!graph) {
                return;
            }
            const original = graph.onNodeRemoved;
            graph.onNodeRemoved = function patchedOnNodeRemoved(removedNode) {
                if (removedNode === node) {
                    closePanel("node-removed");
                }
                if (typeof original === "function") {
                    return original.apply(this, arguments);
                }
                return undefined;
            };
            state.disposers.push(() => {
                graph.onNodeRemoved = original;
            });
        }

        function registerNodeRemovalHook(node) {
            const originalOnRemoved = node.onRemoved;
            node.onRemoved = function patchedOnRemoved() {
                closePanel("node-removed");
                if (typeof originalOnRemoved === "function") {
                    return originalOnRemoved.apply(this, arguments);
                }
                return undefined;
            };
            state.disposers.push(() => {
                node.onRemoved = originalOnRemoved;
            });
        }

        function createPanelElements(node) {
            const panel = document.createElement("aside");
            panel.className = PANEL_CLASS;

            const header = document.createElement("div");
            header.className = "dual-panel-subgraph__header";

            const title = document.createElement("div");
            title.className = "dual-panel-subgraph__title";
            title.textContent = node?.title || node?.type || "Subgraph";

            const closeButton = document.createElement("button");
            closeButton.type = "button";
            closeButton.className = "dual-panel-subgraph__close";
            closeButton.textContent = "Close";
            closeButton.addEventListener("click", () => closePanel("button"));

            header.appendChild(title);
            header.appendChild(closeButton);

            const canvasHost = document.createElement("div");
            canvasHost.className = "dual-panel-subgraph__canvas";

            const canvas = document.createElement("canvas");
            canvas.className = "litegraph";
            canvasHost.appendChild(canvas);

            const resizeHandle = document.createElement("div");
            resizeHandle.className = "dual-panel-subgraph__resize-handle";

            panel.appendChild(header);
            panel.appendChild(resizeHandle);
            panel.appendChild(canvasHost);

            return { panel, canvasHost, canvas, resizeHandle };
        }

        function updatePanelOffset(panel, canvasHost) {
            const topBar = document.querySelector(".comfy-menu");
            const canvasContainer = document.getElementById("graph-canvas");
            const topBarBottom = topBar ? topBar.getBoundingClientRect().bottom : 0;
            const containerTop = canvasContainer ? canvasContainer.getBoundingClientRect().top : 0;
            const offset = Math.max(topBarBottom, containerTop, 0);
            const offsetPx = `${Math.round(offset)}px`;
            document.documentElement.style.setProperty("--dual-panel-top-offset", offsetPx);
            if (panel) {
                panel.style.top = offsetPx;
                panel.style.height = `calc(100vh - ${offsetPx})`;
            }
            if (canvasHost) {
                canvasHost.style.height = `calc(100vh - ${offsetPx})`;
            }
        }

        function syncLayoutFromPanel(panel, canvasHost) {
            const width = panel.getBoundingClientRect().width;
            if (width > 0) {
                document.documentElement.style.setProperty("--dual-panel-subgraph-width", `${Math.round(width)}px`);
            }
            updatePanelOffset(panel, canvasHost);
        }

        function openPanel(node) {
            closePanel("replacement");

            if (!node?.subgraph) {
                console.warn("[DualPanel] Attempted to open panel for node without subgraph", node);
                return false;
            }

            ensureMainHosts();
            state.rootCanvas = app.canvas ?? null;
            state.panelHasFocus = false;

            const { panel, canvasHost, canvas, resizeHandle } = createPanelElements(node);
            document.body.appendChild(panel);
            document.body.classList.add(BODY_CLASS);

            const storedWidth = loadStoredPanelWidth();
            if (storedWidth) {
                setPanelWidth(storedWidth, { panel, canvasHost, canvas });
            }

            const stopEventPropagation = (event) => {
                event.stopPropagation();
            };
            const subgraphCanvasEvents = ["pointerdown", "pointerup", "dblclick", "contextmenu"];
            subgraphCanvasEvents.forEach((evtName) => {
                canvas.addEventListener(evtName, stopEventPropagation);
            });
            state.disposers.push(() => {
                subgraphCanvasEvents.forEach((evtName) => {
                    canvas.removeEventListener(evtName, stopEventPropagation);
                });
            });

            const subgraph = node.subgraph;
            const graphCanvas = new LiteGraph.LGraphCanvas(canvas, null, {
                skip_render: true,
            });
            graphCanvas.allow_dragcanvas = true;
            graphCanvas.allow_dragnodes = true;
            graphCanvas.allow_searchbox = true;

            graphCanvas.setGraph(subgraph);
            graphCanvas.subgraph = subgraph;
            graphCanvas.startRendering?.();

            const suppressedEmitEventSubtypes = new Set([
                "empty-double-click",
                "group-double-click",
                "node-double-click"
            ]);
            const originalEmitEvent = graphCanvas.emitEvent;
            graphCanvas.emitEvent = function (event, ...args) {
                const subtype = event?.subType;
                if (subtype && suppressedEmitEventSubtypes.has(subtype)) {
                    return undefined;
                }
                if (typeof originalEmitEvent === "function") {
                    return originalEmitEvent.call(this, event, ...args);
                }
                return undefined;
            };
            state.disposers.push(() => {
                graphCanvas.emitEvent = originalEmitEvent;
            });

            state.panel = panel;
            state.node = node;
            state.graphCanvas = graphCanvas;

            setupPanelResizer(panel, canvasHost, canvas, graphCanvas, resizeHandle);

            const panelResizeObserver = new ResizeObserver(() => {
                syncLayoutFromPanel(panel, canvasHost);
                handleResize(canvas, graphCanvas);
            });
            panelResizeObserver.observe(panel);
            state.disposers.push(() => panelResizeObserver.disconnect());

            const canvasResizeObserver = new ResizeObserver(() => handleResize(canvas, graphCanvas));
            canvasResizeObserver.observe(canvasHost);
            state.disposers.push(() => canvasResizeObserver.disconnect());

            syncLayoutFromPanel(panel, canvasHost);
            handleResize(canvas, graphCanvas);

            attachFocusHandlers(canvas, graphCanvas);
            registerEscapeListener();
            registerGraphRemovalWatcher(node);
            registerNodeRemovalHook(node);

            LiteGraph.active_canvas = graphCanvas;

            state.disposers.push(() => {
                canvasHost.replaceChildren();
            });

            console.debug("[DualPanel] Subgraph panel opened", {
                node_id: node.id,
                node_title: node.title,
            });

            return true;
        }

        function isSubgraphNode(node) {
            if (!node) {
                return false;
            }
            if (typeof node.isSubgraphNode === "function") {
                try {
                    return Boolean(node.isSubgraphNode());
                } catch (error) {
                    console.warn("[DualPanel] node.isSubgraphNode() threw", error);
                }
            }
            return Boolean(node.subgraph);
        }

        function togglePanel(node) {
            if (!isSubgraphNode(node)) {
                return false;
            }
            if (state.panel && state.node === node) {
                closePanel("toggle");
                return true;
            }
            return openPanel(node);
        }

        async function waitForLGraphCanvasPrototype(maxAttempts = 200, delayMs = 50) {
            for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                const prototype = LiteGraph?.LGraphCanvas?.prototype;
                if (prototype) {
                    return prototype;
                }
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
            return null;
        }

        async function patchOpenSubgraph() {
            const prototype = await waitForLGraphCanvasPrototype();
            if (!prototype) {
                console.warn("[DualPanel] Unable to locate LiteGraph canvas prototype.");
                return;
            }
            if (prototype.__dualPanelPatched) {
                return;
            }

            const originalOpenSubgraph = prototype.openSubgraph;
            prototype.openSubgraph = function dualPanelOpenSubgraph(subgraph, fromNode, ...rest) {
                const candidateNode = fromNode || subgraph?.owner_node || subgraph?.parent_node;
                if (candidateNode && togglePanel(candidateNode)) {
                    return;
                }
                if (typeof originalOpenSubgraph === "function") {
                    return originalOpenSubgraph.call(this, subgraph, fromNode, ...rest);
                }
                return undefined;
            };

            prototype.__dualPanelPatched = true;
        }

        await patchOpenSubgraph();

        console.info("[DualPanel] Patch complete");
        console.info("[DualPanel] DualPanel Subgraph Viewer extension ready");
    },
});
