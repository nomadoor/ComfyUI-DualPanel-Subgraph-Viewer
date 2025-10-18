"""
DualPanel Subgraph Viewer ComfyUI extension.

Exports the required metadata for ComfyUI to discover the JavaScript frontend
extension that implements the dual panel subgraph viewer. No backend nodes are
defined at this time; the functionality is delivered entirely through the JS
layer as specified by docs.comfy.org.
"""

from __future__ import annotations

WEB_DIRECTORY = "./js"
NODE_CLASS_MAPPINGS: dict[str, type] = {}
NODE_DISPLAY_NAME_MAPPINGS: dict[str, str] = {}

__all__ = [
    "WEB_DIRECTORY",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
