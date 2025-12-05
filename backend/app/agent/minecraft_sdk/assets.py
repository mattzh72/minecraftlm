"""
Helpers for loading Minecraft block assets for the Python SDK.

The static asset bundle for the SDK lives under this package's ``static/``
directory and is centered around a single ``assets.json`` payload – a JSON
conversion of the Minecraft assets bundle (blockstates, models, textures).

From this payload we derive:

- ``LegacyAssets.assets``: full decoded ``assets`` object.
- ``LegacyAssets.block_ids``: set of valid block identifiers.
- ``LegacyAssets.block_properties``: mapping of block id to property name and
  allowed discrete values.
- ``LegacyAssets.required_properties``: mapping of block id to property names
  that are inferred to be required for that block's state.
"""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Mapping, MutableMapping, Set, Tuple


PACKAGE_ROOT = Path(__file__).resolve().parent
STATIC_DIR = PACKAGE_ROOT / "static"
DEFAULT_ASSETS_PATH = STATIC_DIR / "assets.json"


def _parse_assets_file(path: Path) -> Dict[str, Any]:
    """Parse ``assets.json`` and return the decoded JSON payload."""
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _normalize_block_id(block_id: str) -> str:
    """Ensure block ids are namespaced with ``minecraft:``."""
    return block_id if block_id.startswith("minecraft:") else f"minecraft:{block_id}"


def _build_block_state_schema(
    assets: Mapping[str, Any],
) -> Tuple[
    Dict[str, Dict[str, Tuple[str, ...]]],
    Dict[str, Tuple[str, ...]],
]:
    """
    Derive block properties and required-property hints from ``assets.json``.

    Returns two dictionaries keyed by fully-qualified block id (``minecraft:...``):

    - ``block_properties[block_id]`` -> ``{property_name: (allowed_values...)}``
    - ``required_properties[block_id]`` -> ``(property_name, ...)`` inferred from
      ``variants`` keys (i.e. properties that participate in discrete block
      states, as opposed to purely adjacency-driven multipart conditions).

    This is intentionally a light-weight view over the much larger ``assets``
    payload and is used by the SDK for runtime validation and agent guidance.
    """
    blockstates = assets.get("blockstates", {}) if assets else {}
    all_properties: Dict[str, Dict[str, Set[str]]] = {}
    required_flags: Dict[str, Dict[str, bool]] = {}

    for name, spec in blockstates.items():
        full_id = f"minecraft:{name}"
        props: MutableMapping[str, Set[str]] = defaultdict(set)
        flags: MutableMapping[str, bool] = {}

        variants = spec.get("variants", {}) or {}
        for key in variants.keys():
            if not key:
                continue
            for pair in key.split(","):
                if "=" not in pair:
                    continue
                k, v = pair.split("=", 1)
                props[k].add(v)
                # Seen in a variant key -> treat as a required / intrinsic property.
                if k not in flags:
                    flags[k] = True

        def _walk_when(cond: Any) -> None:
            if isinstance(cond, dict):
                for k, v in cond.items():
                    if k in ("AND", "OR"):
                        for sub in v:
                            _walk_when(sub)
                    else:
                        # Conditions that appear only in multipart when-clauses
                        # generally represent adjacency (e.g. north/east/south/west).
                        flags.setdefault(k, False)
                        if isinstance(v, list):
                            for item in v:
                                props[k].add(str(item))
                        else:
                            props[k].add(str(v))

        for part in spec.get("multipart", []) or []:
            when = part.get("when")
            if when:
                _walk_when(when)

        if not props:
            # Block has a single state with no explicit properties.
            all_properties[full_id] = {}
            required_flags[full_id] = {}
            continue

        # Keep ``all_properties`` in terms of ``Set[str]``; we convert to tuples
        # exactly once when materializing the final schema.
        all_properties[full_id] = dict(props)
        required_flags[full_id] = {
            prop: required for prop, required in flags.items() if required
        }

    block_properties: Dict[str, Dict[str, Tuple[str, ...]]] = {
        block_id: {name: tuple(values) for name, values in props.items()}
        for block_id, props in all_properties.items()
    }
    required_properties: Dict[str, Tuple[str, ...]] = {
        block_id: tuple(sorted(flags.keys())) for block_id, flags in required_flags.items()
    }
    return block_properties, required_properties


@dataclass
class LegacyAssets:
    """
    Thin wrapper around the static asset files.

    This class is intentionally light-weight: it only exposes the data needed
    by the SDK (block ids and block-state schemas), plus the decoded raw
    ``assets`` object for advanced use.
    """

    assets_path: Path = DEFAULT_ASSETS_PATH

    _assets: Dict[str, Any] | None = None
    _block_properties: Dict[str, Dict[str, Tuple[str, ...]]] | None = None
    _required_properties: Dict[str, Tuple[str, ...]] | None = None

    @property
    def assets(self) -> Dict[str, Any]:
        if self._assets is None:
            self._assets = _parse_assets_file(self.assets_path)
        return self._assets

    @property
    def block_ids(self) -> Set[str]:
        blockstates = self.assets.get("blockstates", {}) if self.assets else {}
        return {f"minecraft:{block_id}" for block_id in blockstates.keys()}

    @property
    def block_properties(self) -> Dict[str, Dict[str, Tuple[str, ...]]]:
        """
        Mapping of block id -> property name -> allowed values.

        Example::

            {
                "minecraft:oak_log": {"axis": ("x", "y", "z")},
                "minecraft:oak_planks": {},
            }
        """
        if self._block_properties is None or self._required_properties is None:
            self._block_properties, self._required_properties = _build_block_state_schema(
                self.assets
            )
        return self._block_properties

    @property
    def required_properties(self) -> Dict[str, Tuple[str, ...]]:
        """
        Mapping of block id -> tuple of property names that are inferred to be
        required / intrinsic for that block's state.

        These are properties that appear in ``variants`` keys in the underlying
        blockstate definitions, as opposed to purely adjacency-driven multipart
        ``when`` clauses. The SDK uses this as a hint when validating block
        properties supplied by the agent.
        """
        if self._required_properties is None or self._block_properties is None:
            self._block_properties, self._required_properties = _build_block_state_schema(
                self.assets
            )
        return self._required_properties

    def is_known(self, block_id: str) -> bool:
        return _normalize_block_id(block_id) in self.block_ids
