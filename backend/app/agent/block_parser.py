"""
Best-effort parser for extracting Block() definitions from streaming Python code.

This parser extracts block information from edit_code tool arguments as they stream,
enabling real-time block preview rendering before code execution completes.
"""

import re
from dataclasses import dataclass, field


@dataclass
class ParsedBlock:
    """A block extracted from streaming code"""

    block_id: str
    size: tuple[int, int, int] = (1, 1, 1)
    position: tuple[float, float, float] = (0.0, 0.0, 0.0)
    properties: dict = field(default_factory=dict)
    fill: bool = True
    variable_name: str | None = None


class BlockStreamParser:
    """
    Best-effort parser for Block() calls from streaming Python code.

    Extracts block definitions by matching patterns like:
        block = Block("minecraft:stone", size=(3, 1, 3), fill=True, catalog=catalog)
        block.position.set(5, 0, 5)

    Limitations (accepted):
    - Cannot parse computed positions (e.g., i*2, x+offset)
    - Cannot unroll loops
    - Cannot evaluate helper functions
    - Estimated 60-80% accuracy for typical generated code
    """

    # Match: varname = Block("minecraft:stone" - captures start of Block call
    BLOCK_START_RE = re.compile(
        r"(\w+)\s*=\s*Block\s*\(\s*"  # var = Block(
        r'["\']([^"\']+)["\']',  # "minecraft:stone"
    )

    # Extract size from within a Block() call body
    SIZE_RE = re.compile(r"size\s*=\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)")

    # Extract fill from within a Block() call body
    FILL_RE = re.compile(r"fill\s*=\s*(True|False)")

    # Match: varname.position.set(x, y, z) - supports int/float literals
    POSITION_RE = re.compile(
        r"(\w+)\.position\.set\s*\(\s*"
        r"([-\d.]+)\s*,\s*"
        r"([-\d.]+)\s*,\s*"
        r"([-\d.]+)\s*\)"
    )

    def __init__(self):
        self.buffer = ""
        self.blocks: dict[str, ParsedBlock] = {}  # var_name -> block
        self.emitted_ids: set[str] = set()  # Track already-emitted blocks

    def reset(self):
        """Reset parser state for a new streaming session"""
        self.buffer = ""
        self.blocks.clear()
        self.emitted_ids.clear()

    def _find_block_body(self, code: str, start_pos: int) -> str | None:
        """
        Find the complete Block() call body starting from start_pos.
        Handles nested parentheses properly.
        Returns the content between ( and matching ), or None if incomplete.
        """
        # Find the opening ( of Block(
        paren_start = code.find("(", start_pos)
        if paren_start == -1:
            return None

        depth = 1
        i = paren_start + 1
        while i < len(code) and depth > 0:
            if code[i] == "(":
                depth += 1
            elif code[i] == ")":
                depth -= 1
            i += 1

        if depth == 0:
            # Found complete Block() call
            return code[paren_start + 1 : i - 1]
        return None  # Incomplete

    def feed(self, code_fragment: str) -> list[ParsedBlock]:
        """
        Feed a code fragment, return any newly found blocks.

        Blocks are emitted as soon as the Block() constructor is found.
        Position defaults to (0,0,0) and is updated if position.set() is found.
        """
        self.buffer += code_fragment
        results = []

        # Find Block() assignments and emit immediately
        for match in self.BLOCK_START_RE.finditer(self.buffer):
            var_name = match.group(1)
            if var_name in self.emitted_ids:
                continue

            block_id = match.group(2)

            # Find complete Block() body with proper paren matching
            call_body = self._find_block_body(self.buffer, match.start())
            if call_body is None:
                continue  # Block call not complete yet

            # Parse size from call body, defaulting to (1,1,1)
            size = (1, 1, 1)
            size_match = self.SIZE_RE.search(call_body)
            if size_match:
                size = (
                    int(size_match.group(1)),
                    int(size_match.group(2)),
                    int(size_match.group(3)),
                )

            # Parse fill from call body, defaulting to True
            fill = True
            fill_match = self.FILL_RE.search(call_body)
            if fill_match:
                fill = fill_match.group(1) != "False"

            block = ParsedBlock(
                block_id=block_id,
                size=size,
                fill=fill,
                variable_name=var_name,
            )
            self.blocks[var_name] = block
            self.emitted_ids.add(var_name)
            results.append(block)

        # Update positions for any blocks that have position.set() calls
        for match in self.POSITION_RE.finditer(self.buffer):
            var_name = match.group(1)
            if var_name in self.blocks:
                self.blocks[var_name].position = (
                    float(match.group(2)),
                    float(match.group(3)),
                    float(match.group(4)),
                )

        return results

    def to_block_json(self, block: ParsedBlock) -> dict:
        """
        Convert ParsedBlock to structure JSON format.

        Returns format compatible with the structure.blocks array:
        {
            "start": [x, y, z],
            "end": [x+sx, y+sy, z+sz],
            "type": "minecraft:stone",
            "properties": {},
            "fill": true
        }
        """
        x, y, z = block.position
        sx, sy, sz = block.size

        # Ensure block_id has minecraft: prefix
        block_id = block.block_id
        if not block_id.startswith("minecraft:"):
            block_id = f"minecraft:{block_id}"

        return {
            "start": [int(x), int(y), int(z)],
            "end": [int(x + sx), int(y + sy), int(z + sz)],
            "type": block_id,
            "properties": block.properties,
            "fill": block.fill,
        }

    def to_block_json_chunks(
        self, block: ParsedBlock, max_chunk_size: int = 8
    ) -> list[dict]:
        """
        Convert ParsedBlock to one or more structure JSON blocks.

        Large blocks are split into smaller chunks for faster streaming preview.
        Each chunk is at most max_chunk_size in any dimension.
        """
        x, y, z = block.position
        sx, sy, sz = block.size

        # Normalize block_id
        block_id = block.block_id
        if not block_id.startswith("minecraft:"):
            block_id = f"minecraft:{block_id}"

        # If block is small enough, return as-is
        if sx <= max_chunk_size and sy <= max_chunk_size and sz <= max_chunk_size:
            return [self.to_block_json(block)]

        # Split into chunks
        chunks = []
        for cx in range(0, sx, max_chunk_size):
            for cy in range(0, sy, max_chunk_size):
                for cz in range(0, sz, max_chunk_size):
                    chunk_sx = min(max_chunk_size, sx - cx)
                    chunk_sy = min(max_chunk_size, sy - cy)
                    chunk_sz = min(max_chunk_size, sz - cz)

                    chunks.append(
                        {
                            "start": [int(x + cx), int(y + cy), int(z + cz)],
                            "end": [
                                int(x + cx + chunk_sx),
                                int(y + cy + chunk_sy),
                                int(z + cz + chunk_sz),
                            ],
                            "type": block_id,
                            "properties": block.properties,
                            "fill": block.fill,
                        }
                    )

        return chunks
