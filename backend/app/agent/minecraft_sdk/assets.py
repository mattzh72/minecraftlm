"""
Helpers for loading Minecraft block assets for the Python SDK.

The static asset bundle for the SDK lives under this package's ``static/``
directory:

- ``assets.json`` – the full ``assets`` structure (blockstates, models, textures)
  converted to JSON.
- ``opaque.txt`` – one opaque block id per line.
- ``transparent.txt`` – one transparent block id per line.
- ``non_self_culling.txt`` – one non-self-culling block id per line.

This module parses those files and exposes a small Python-friendly interface:

- ``LegacyAssets.assets``: full decoded ``assets`` object.
- ``LegacyAssets.block_ids``: set of valid block identifiers.
- ``LegacyAssets.opaque_blocks``: set of opaque block ids.
- ``LegacyAssets.transparent_blocks``: set of transparent block ids.
- ``LegacyAssets.non_self_culling_blocks``: set of leaf-like blocks that should
  not cull faces against themselves.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Set


PACKAGE_ROOT = Path(__file__).resolve().parent
STATIC_DIR = PACKAGE_ROOT / "static"
DEFAULT_ASSETS_PATH = STATIC_DIR / "assets.json"
DEFAULT_OPAQUE_PATH = STATIC_DIR / "opaque.txt"
DEFAULT_TRANSPARENT_PATH = STATIC_DIR / "transparent.txt"
DEFAULT_NON_SELF_CULLING_PATH = STATIC_DIR / "non_self_culling.txt"


def _parse_assets_file(path: Path) -> Dict[str, Any]:
    """Parse ``assets.json`` and return the decoded JSON payload."""
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _parse_block_list(path: Path) -> Set[str]:
    """
    Extract block ids from a text file.

    The file is expected to contain one block id per line, but this function is
    tolerant and will also pick up any ``minecraft:...`` substrings it finds.
    """
    if not path.exists():
        return set()

    text = path.read_text(encoding="utf-8")
    ids = set(re.findall(r"minecraft:[a-z0-9_]+", text))
    return ids


def _normalize_block_id(block_id: str) -> str:
    """Ensure block ids are namespaced with ``minecraft:``."""
    return block_id if block_id.startswith("minecraft:") else f"minecraft:{block_id}"


@dataclass
class LegacyAssets:
    """
    Thin wrapper around the static asset files.

    This class is intentionally light-weight: it only exposes the data needed
    by the SDK (block ids and opacity flags), plus the decoded raw ``assets``
    object for advanced use.
    """

    assets_path: Path = DEFAULT_ASSETS_PATH
    opaque_path: Path = DEFAULT_OPAQUE_PATH
    transparent_path: Path = DEFAULT_TRANSPARENT_PATH
    non_self_culling_path: Path = DEFAULT_NON_SELF_CULLING_PATH

    _assets: Dict[str, Any] | None = None
    _opaque_blocks: Set[str] | None = None
    _transparent_blocks: Set[str] | None = None
    _non_self_culling_blocks: Set[str] | None = None

    @property
    def assets(self) -> Dict[str, Any]:
        if self._assets is None:
            self._assets = _parse_assets_file(self.assets_path)
        return self._assets

    @property
    def opaque_blocks(self) -> Set[str]:
        if self._opaque_blocks is None:
            self._opaque_blocks = _parse_block_list(self.opaque_path)
        return self._opaque_blocks

    @property
    def transparent_blocks(self) -> Set[str]:
        if self._transparent_blocks is None:
            self._transparent_blocks = _parse_block_list(self.transparent_path)
        return self._transparent_blocks

    @property
    def non_self_culling_blocks(self) -> Set[str]:
        if self._non_self_culling_blocks is None:
            self._non_self_culling_blocks = _parse_block_list(
                self.non_self_culling_path
            )
        return self._non_self_culling_blocks

    @property
    def block_ids(self) -> Set[str]:
        blockstates = self.assets.get("blockstates", {}) if self.assets else {}
        return {f"minecraft:{block_id}" for block_id in blockstates.keys()}

    def is_known(self, block_id: str) -> bool:
        return _normalize_block_id(block_id) in self.block_ids

    def is_opaque(self, block_id: str) -> bool:
        return _normalize_block_id(block_id) in self.opaque_blocks
