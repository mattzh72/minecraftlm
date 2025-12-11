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

    Emits blocks eagerly as soon as the block type is seen, then re-emits
    updates when size or position information becomes available.

    Limitations (accepted):
    - Cannot parse computed positions (e.g., i*2, x+offset)
    - Cannot unroll loops
    - Cannot evaluate helper functions
    - Estimated 60-80% accuracy for typical generated code
    """

    # Match: varname = Block("minecraft:stone" - captures start of Block call
    # Emits immediately when we see the block type string
    # Uses re.DOTALL to handle multiline (Block(\n    "type"))
    BLOCK_START_RE = re.compile(
        r"(\w+)\s*=\s*Block\s*\(\s*"  # var = Block(
        r'["\']([^"\']+)["\']',  # "minecraft:stone"
        re.DOTALL,
    )

    # Match inline blocks without variable assignment: Block("minecraft:stone"
    # These are used inside scene.add(Block(...)) patterns
    # Generates synthetic variable names like _inline_0, _inline_1
    INLINE_BLOCK_RE = re.compile(
        r'(?<!=\s)Block\s*\(\s*["\']([^"\']+)["\']',  # Block( not preceded by =
        re.DOTALL,
    )

    # Extract size - can appear anywhere after the block definition
    # Matches both inline size=(x,y,z) and size anywhere in buffer
    # Uses re.DOTALL to handle multiline
    SIZE_RE = re.compile(
        r"size\s*=\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)",
        re.DOTALL,
    )

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
        self.emitted_ids: set[str] = set()  # Track blocks we've emitted at least once
        # Track what we've emitted to detect updates
        self.emitted_state: dict[str, tuple] = {}  # var_name -> (size, position, fill)

    def reset(self):
        """Reset parser state for a new streaming session"""
        self.buffer = ""
        self.blocks.clear()
        self.emitted_ids.clear()
        self.emitted_state.clear()

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

    def _get_block_state(self, block: ParsedBlock) -> tuple:
        """Get current state tuple for change detection."""
        return (block.size, block.position, block.fill)

    def _should_emit(self, var_name: str, block: ParsedBlock) -> bool:
        """Check if block state has changed since last emission."""
        current_state = self._get_block_state(block)
        if var_name not in self.emitted_state:
            return True
        return self.emitted_state[var_name] != current_state

    def _extract_size_after_match(
        self, buffer: str, match_end: int
    ) -> tuple[int, int, int] | None:
        """
        Extract size from buffer after a Block() match.
        Looks for size=(x,y,z) in the text following the block type.
        """
        # Look in a reasonable window after the block type (before next Block or end)
        search_window = buffer[match_end : match_end + 200]
        size_match = self.SIZE_RE.search(search_window)
        if size_match:
            return (
                int(size_match.group(1)),
                int(size_match.group(2)),
                int(size_match.group(3)),
            )
        return None

    def _extract_fill_after_match(self, buffer: str, match_end: int) -> bool | None:
        """
        Extract fill from buffer after a Block() match.
        """
        search_window = buffer[match_end : match_end + 200]
        fill_match = self.FILL_RE.search(search_window)
        if fill_match:
            return fill_match.group(1) != "False"
        return None

    def feed(self, code_fragment: str) -> list[ParsedBlock]:
        """
        Feed a code fragment, return any newly found or updated blocks.

        Blocks are emitted EAGERLY as soon as Block("type") is seen,
        with default size (1,1,1). Re-emits when size or position updates.

        Note: This method expects the FULL accumulated code each time,
        not incremental deltas. It replaces the buffer rather than appending.
        """
        # Replace buffer with new content (caller passes full accumulated code)
        self.buffer = code_fragment
        results = []

        # Track positions of assigned blocks to avoid double-matching
        assigned_block_positions: set[int] = set()

        # Find Block() assignments - emit immediately when we see the type
        for match in self.BLOCK_START_RE.finditer(self.buffer):
            var_name = match.group(1)
            block_id = match.group(2)
            assigned_block_positions.add(match.start())

            # Create or update block
            if var_name not in self.blocks:
                self.blocks[var_name] = ParsedBlock(
                    block_id=block_id,
                    size=(1, 1, 1),  # Default, will update
                    fill=True,
                    variable_name=var_name,
                )

            block = self.blocks[var_name]

            # Try to extract size (may not be complete yet)
            size = self._extract_size_after_match(self.buffer, match.end())
            if size:
                block.size = size

            # Try to extract fill
            fill = self._extract_fill_after_match(self.buffer, match.end())
            if fill is not None:
                block.fill = fill

        # Find inline Block() calls (no variable assignment)
        # e.g., scene.add(Block("minecraft:stone", size=(5,5,5)))
        inline_counter = 0
        for match in self.INLINE_BLOCK_RE.finditer(self.buffer):
            # Skip if this position was already matched by BLOCK_START_RE
            # Check if any assigned block contains this position
            is_assigned = False
            for pos in assigned_block_positions:
                # The inline match would be within ~50 chars of an assigned match
                if abs(match.start() - pos) < 50:
                    is_assigned = True
                    break
            if is_assigned:
                continue

            block_id = match.group(1)
            # Generate synthetic variable name based on position in buffer
            var_name = f"_inline_{match.start()}"

            if var_name not in self.blocks:
                self.blocks[var_name] = ParsedBlock(
                    block_id=block_id,
                    size=(1, 1, 1),
                    fill=True,
                    variable_name=var_name,
                )
                inline_counter += 1

            block = self.blocks[var_name]

            # Try to extract size
            size = self._extract_size_after_match(self.buffer, match.end())
            if size:
                block.size = size

            # Try to extract fill
            fill = self._extract_fill_after_match(self.buffer, match.end())
            if fill is not None:
                block.fill = fill

        # Update positions for any blocks that have position.set() calls
        for match in self.POSITION_RE.finditer(self.buffer):
            var_name = match.group(1)
            if var_name in self.blocks:
                self.blocks[var_name].position = (
                    float(match.group(2)),
                    float(match.group(3)),
                    float(match.group(4)),
                )

        # Emit blocks that are new or have changed
        for var_name, block in self.blocks.items():
            if self._should_emit(var_name, block):
                self.emitted_state[var_name] = self._get_block_state(block)
                self.emitted_ids.add(var_name)
                results.append(block)

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
            "fill": true,
            "variable_name": "block1"  # For deduplication
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
            "variable_name": block.variable_name,
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

        # Split into chunks - all chunks share variable_name for deduplication
        chunks = []
        chunk_index = 0
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
                            # Append chunk index to variable_name for unique identification
                            "variable_name": f"{block.variable_name}__chunk_{chunk_index}"
                            if block.variable_name
                            else None,
                        }
                    )
                    chunk_index += 1

        return chunks
