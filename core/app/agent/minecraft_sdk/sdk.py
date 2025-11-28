"""
Python SDK for composing Minecraft voxel scenes.

The design mirrors a small subset of Three.js concepts:

- ``Vector3``: positions
- ``Object3D``: nodes in a scene graph
- ``Block``: a cuboid of a single Minecraft block type
- ``Scene``: root node that can export a structure dictionary
- ``BlockCatalog``: validates block ids and exposes asset metadata

The exported structure dictionary has the form::

    {
        "width": int,
        "height": int,
        "depth": int,
        "blocks": [
            {
                "start": [x, y, z],
                "end": [ex, ey, ez],
                "type": "minecraft:stone",
                "properties": {"facing": "south"},
                "fill": True,
            },
            ...
        ],
    }
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from app.agent.minecraft_sdk.assets import LegacyAssets, _normalize_block_id


class BlockCatalog:
    """Catalog of known block ids and basic metadata."""

    def __init__(self, assets: Optional[LegacyAssets] = None) -> None:
        self._assets = assets or LegacyAssets()

    @property
    def block_ids(self) -> set[str]:
        """All valid block ids (``minecraft:<name>``)."""
        return self._assets.block_ids

    @property
    def opaque_blocks(self) -> set[str]:
        """Block ids that should be treated as opaque for rendering."""
        return self._assets.opaque_blocks

    @property
    def assets(self) -> dict[str, Any]:
        """Raw decoded ``assets`` object (blockstates, models, textures)."""
        return self._assets.assets

    def assert_valid(self, block_id: str) -> str:
        """
        Normalize and validate a block id.

        If the id is unknown but the catalog has no data (e.g. assets failed
        to load), the id is returned without validation.
        """
        normalized = _normalize_block_id(block_id)
        if self.block_ids and normalized not in self.block_ids:
            raise ValueError(
                f'Unknown block id "{block_id}". '
                f"Expected one of {len(self.block_ids)} known blocks."
            )
        return normalized

    def is_opaque(self, block_id: str) -> bool:
        return self._assets.is_opaque(block_id)


@dataclass
class Vector3:
    """Simple 3D vector used for positions."""

    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

    def set(self, x: float = 0.0, y: float = 0.0, z: float = 0.0) -> "Vector3":
        self.x = x
        self.y = y
        self.z = z
        return self

    def clone(self) -> "Vector3":
        return Vector3(self.x, self.y, self.z)

    def add(self, other: "Vector3") -> "Vector3":
        self.x += other.x
        self.y += other.y
        self.z += other.z
        return self

    def added(self, other: "Vector3") -> "Vector3":
        return self.clone().add(other)

    def to_tuple(self) -> Tuple[float, float, float]:
        return (self.x, self.y, self.z)


class Object3D:
    """
    Base class for scene graph nodes.

    Mirrors a very small subset of Three.js's Object3D:

    - ``position: Vector3``
    - ``children: list[Object3D]``
    - ``add(*objects)`` to attach children
    """

    def __init__(self) -> None:
        self.position = Vector3()
        self.children: List[Object3D] = []

    def add(self, *objects: "Object3D") -> "Object3D":
        self.children.extend(objects)
        return self


class Block(Object3D):
    """
    Represents a cuboid of a single Minecraft block type.

    ``size`` is given in blocks as ``(width, height, depth)``.
    """

    def __init__(
        self,
        block_id: str,
        *,
        size: Sequence[int] = (1, 1, 1),
        properties: Optional[Dict[str, str]] = None,
        fill: bool = True,
        catalog: Optional[BlockCatalog] = None,
    ) -> None:
        super().__init__()
        self._catalog = catalog or BlockCatalog()
        self.block_id = self._catalog.assert_valid(block_id)
        if len(size) != 3:
            raise ValueError("size must be a sequence of three integers")
        self.size: Tuple[int, int, int] = (int(size[0]), int(size[1]), int(size[2]))
        self.properties: Dict[str, str] = dict(properties) if properties else {}
        self.fill: bool = bool(fill)

    def set_properties(self, properties: Dict[str, str]) -> "Block":
        self.properties = dict(properties)
        return self

    def merge_properties(self, extra: Dict[str, str]) -> "Block":
        merged = dict(self.properties)
        merged.update(extra)
        self.properties = merged
        return self


class Scene(Object3D):
    """
    Root node holding a graph of ``Object3D`` and ``Block`` instances.

    Use ``to_structure()`` to export a structure dictionary.
    """

    def __init__(self) -> None:
        super().__init__()

    def _flatten_blocks(
        self,
        parent_offset: Optional[Vector3] = None,
    ) -> List[Tuple[Block, Vector3]]:
        world_offset = (parent_offset or Vector3()).clone().add(self.position)
        placements: List[Tuple[Block, Vector3]] = []

        for child in self.children:
            if isinstance(child, Block):
                placements.append((child, world_offset.added(child.position)))
            elif isinstance(child, Object3D):
                if hasattr(child, "_flatten_blocks"):
                    # Child is another Scene-like object
                    placements.extend(child._flatten_blocks(world_offset))  # type: ignore[arg-type]
                else:
                    # Generic Object3D: descend manually
                    for grandchild in child.children:
                        if isinstance(grandchild, Block):
                            placements.append(
                                (grandchild, world_offset.added(grandchild.position))
                            )

        return placements

    def to_structure(
        self,
        *,
        origin: str = "min",
        padding: int = 0,
        dimensions: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        """
        Export the scene to a structure dictionary.

        Args:
            origin: If ``"min"`` (default), shift so the smallest coordinate
                becomes ``(0,0,0)`` before applying padding. Any other value
                leaves positions as-is and only applies padding.
            padding: Number of empty blocks to add around the bounding box.
            dimensions: Optional explicit ``{"width": int, "height": int,
                "depth": int}`` to override the automatically computed size.
        """
        placements = self._flatten_blocks()
        if not placements:
            raise ValueError("Scene has no blocks to export.")

        min_x = float("inf")
        min_y = float("inf")
        min_z = float("inf")
        max_x = float("-inf")
        max_y = float("-inf")
        max_z = float("-inf")

        for block, position in placements:
            sx, sy, sz = position.to_tuple()
            dx, dy, dz = block.size
            ex = sx + dx
            ey = sy + dy
            ez = sz + dz

            min_x = min(min_x, sx)
            min_y = min(min_y, sy)
            min_z = min(min_z, sz)
            max_x = max(max_x, ex)
            max_y = max(max_y, ey)
            max_z = max(max_z, ez)

        span_x = max_x - min_x
        span_y = max_y - min_y
        span_z = max_z - min_z

        if origin == "min":
            offset = Vector3(
                padding - min_x,
                padding - min_y,
                padding - min_z,
            )
        else:
            offset = Vector3(float(padding), float(padding), float(padding))

        width = dimensions.get("width") if dimensions else None
        height = dimensions.get("height") if dimensions else None
        depth = dimensions.get("depth") if dimensions else None

        if width is None:
            width = int(span_x + padding * 2)
        if height is None:
            height = int(span_y + padding * 2)
        if depth is None:
            depth = int(span_z + padding * 2)

        blocks: List[Dict[str, Any]] = []
        for block, position in placements:
            sx, sy, sz = position.added(offset).to_tuple()
            dx, dy, dz = block.size
            start = [int(round(sx)), int(round(sy)), int(round(sz))]
            end = [
                start[0] + int(dx),
                start[1] + int(dy),
                start[2] + int(dz),
            ]
            entry: Dict[str, Any] = {
                "start": start,
                "end": end,
                "type": block.block_id,
                "fill": block.fill,
            }
            if block.properties:
                entry["properties"] = dict(block.properties)
            blocks.append(entry)

        return {
            "width": int(width),
            "height": int(height),
            "depth": int(depth),
            "blocks": blocks,
        }


# --- Orientation helpers (block-state aware) ---

_CARDINALS: Tuple[str, ...] = ("north", "east", "south", "west")


def facing_from_vector(x: float, z: float) -> str:
    """
    Compute the dominant horizontal facing from a vector (ignores Y).

    Args:
        x: X component (east-west).
        z: Z component (south-north).
    """
    if abs(x) >= abs(z):
        return "east" if x >= 0 else "west"
    return "south" if z >= 0 else "north"


def stair_properties(
    *,
    facing: str = "north",
    upside_down: bool = False,
    shape: str = "straight",
) -> Dict[str, str]:
    """
    Helper for stair block states: facing + half + shape.

    - facing: one of ``"north" | "south" | "east" | "west"``
    - upside_down: if True, uses ``half="top"``; otherwise ``half="bottom"``
    - shape: one of ``"straight" | "inner_left" | "inner_right"
      | "outer_left" | "outer_right"``
    """
    if facing not in _CARDINALS:
        raise ValueError(f'Invalid stair facing "{facing}"')
    return {
        "facing": facing,
        "half": "top" if upside_down else "bottom",
        "shape": shape,
    }


def axis_properties(axis: str = "y") -> Dict[str, str]:
    """
    Helper for logs/pillars: set axis based on orientation.

    - axis: one of ``"x" | "y" | "z"``
    """
    if axis not in ("x", "y", "z"):
        raise ValueError(f'Invalid axis "{axis}"')
    return {"axis": axis}


def slab_properties(*, top: bool = False, double: bool = False) -> Dict[str, str]:
    """
    Helper for slabs: choose placement type.

    - bottom slab: ``slab_properties()``
    - top slab: ``slab_properties(top=True)``
    - double slab: ``slab_properties(double=True)``
    """
    slab_type = "double" if double else "top" if top else "bottom"
    return {"type": slab_type}


def make_stair(
    block_id: str,
    *,
    direction: str = "north",
    upside_down: bool = False,
    catalog: Optional[BlockCatalog] = None,
) -> Block:
    """Quick factory for a single-block stair with orientation helpers."""
    props = stair_properties(facing=direction, upside_down=upside_down)
    return Block(block_id, properties=props, catalog=catalog)

