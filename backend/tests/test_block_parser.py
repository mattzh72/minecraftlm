"""
Tests for BlockStreamParser, particularly the chunking functionality.
"""

import pytest

from app.agent.block_parser import BlockStreamParser, ParsedBlock


class TestBlockStreamParser:
    """Test BlockStreamParser functionality"""

    @pytest.fixture
    def parser(self):
        return BlockStreamParser()

    def test_small_block_returns_single_chunk(self, parser):
        """Small blocks (all dimensions <= 8) should return a single chunk"""
        block = ParsedBlock(
            block_id="minecraft:stone",
            size=(5, 3, 8),
            position=(0, 0, 0),
        )
        chunks = parser.to_block_json_chunks(block)

        assert len(chunks) == 1
        assert chunks[0]["start"] == [0, 0, 0]
        assert chunks[0]["end"] == [5, 3, 8]
        assert chunks[0]["type"] == "minecraft:stone"

    def test_large_block_splits_into_chunks(self, parser):
        """Large blocks should be split into 8x8x8 chunks"""
        block = ParsedBlock(
            block_id="minecraft:stone",
            size=(16, 1, 16),  # 16x1x16 = 2x1x2 grid of chunks
            position=(0, 0, 0),
        )
        chunks = parser.to_block_json_chunks(block)

        # Should be 2*1*2 = 4 chunks
        assert len(chunks) == 4

        # Verify chunks cover the full area
        covered_starts = {tuple(c["start"]) for c in chunks}
        assert (0, 0, 0) in covered_starts
        assert (8, 0, 0) in covered_starts
        assert (0, 0, 8) in covered_starts
        assert (8, 0, 8) in covered_starts

    def test_large_block_with_position_offset(self, parser):
        """Chunked blocks should respect position offset"""
        block = ParsedBlock(
            block_id="minecraft:stone",
            size=(16, 1, 16),
            position=(10, 5, 20),
        )
        chunks = parser.to_block_json_chunks(block)

        # All chunks should be offset by (10, 5, 20)
        for chunk in chunks:
            assert chunk["start"][0] >= 10
            assert chunk["start"][1] >= 5
            assert chunk["start"][2] >= 20

        # First chunk should start at (10, 5, 20)
        starts = [tuple(c["start"]) for c in chunks]
        assert (10, 5, 20) in starts

    def test_edge_case_9x1x1_becomes_two_chunks(self, parser):
        """A 9x1x1 block should become two chunks: 8x1x1 + 1x1x1"""
        block = ParsedBlock(
            block_id="minecraft:stone",
            size=(9, 1, 1),
            position=(0, 0, 0),
        )
        chunks = parser.to_block_json_chunks(block)

        assert len(chunks) == 2

        # First chunk: 0-8
        chunk1 = next(c for c in chunks if c["start"] == [0, 0, 0])
        assert chunk1["end"] == [8, 1, 1]

        # Second chunk: 8-9
        chunk2 = next(c for c in chunks if c["start"] == [8, 0, 0])
        assert chunk2["end"] == [9, 1, 1]

    def test_chunks_preserve_block_properties(self, parser):
        """All chunks should have the same properties as the original block"""
        block = ParsedBlock(
            block_id="minecraft:oak_log",
            size=(16, 16, 16),
            position=(0, 0, 0),
            properties={"axis": "y"},
            fill=False,
        )
        chunks = parser.to_block_json_chunks(block)

        for chunk in chunks:
            assert chunk["type"] == "minecraft:oak_log"
            assert chunk["properties"] == {"axis": "y"}
            assert chunk["fill"] is False

    def test_chunks_cover_full_volume(self, parser):
        """All chunks together should cover the exact same volume as the original"""
        block = ParsedBlock(
            block_id="minecraft:stone",
            size=(20, 15, 25),
            position=(0, 0, 0),
        )
        chunks = parser.to_block_json_chunks(block)

        # Calculate total volume from chunks
        total_volume = 0
        for chunk in chunks:
            sx = chunk["end"][0] - chunk["start"][0]
            sy = chunk["end"][1] - chunk["start"][1]
            sz = chunk["end"][2] - chunk["start"][2]
            total_volume += sx * sy * sz

        # Should equal original block volume
        assert total_volume == 20 * 15 * 25

    def test_normalizes_block_id_prefix(self, parser):
        """Block IDs without minecraft: prefix should be normalized"""
        block = ParsedBlock(
            block_id="stone",  # No prefix
            size=(4, 4, 4),
            position=(0, 0, 0),
        )
        chunks = parser.to_block_json_chunks(block)

        assert chunks[0]["type"] == "minecraft:stone"

    def test_custom_chunk_size(self, parser):
        """Custom max_chunk_size should be respected"""
        block = ParsedBlock(
            block_id="minecraft:stone",
            size=(10, 10, 10),
            position=(0, 0, 0),
        )

        # With default chunk size of 8, should split
        chunks_default = parser.to_block_json_chunks(block, max_chunk_size=8)
        assert len(chunks_default) > 1

        # With larger chunk size, should be single chunk
        chunks_large = parser.to_block_json_chunks(block, max_chunk_size=16)
        assert len(chunks_large) == 1


class TestBlockStreamParserFeed:
    """Test the feed() method for parsing streaming code"""

    @pytest.fixture
    def parser(self):
        return BlockStreamParser()

    def test_parses_simple_block(self, parser):
        """Should parse a simple Block() definition"""
        code = 'stone = Block("minecraft:stone", size=(10, 5, 10), catalog=catalog)'
        blocks = parser.feed(code)

        assert len(blocks) == 1
        assert blocks[0].block_id == "minecraft:stone"
        assert blocks[0].size == (10, 5, 10)
        assert blocks[0].variable_name == "stone"

    def test_parses_position_set(self, parser):
        """Should update position from position.set() call"""
        code = '''stone = Block("minecraft:stone", size=(5, 5, 5), catalog=catalog)
stone.position.set(10, 20, 30)'''
        parser.feed(code)

        assert parser.blocks["stone"].position == (10.0, 20.0, 30.0)

    def test_parses_fill_false(self, parser):
        """Should parse fill=False"""
        code = 'wall = Block("minecraft:cobblestone", size=(10, 4, 1), fill=False, catalog=catalog)'
        blocks = parser.feed(code)

        assert len(blocks) == 1
        assert blocks[0].fill is False

    def test_eager_emission_before_size(self, parser):
        """Should emit block immediately when type is seen, even without size"""
        # Feed just the block type - no closing paren yet
        code1 = 'stone = Block("minecraft:stone"'
        blocks1 = parser.feed(code1)

        # Should emit immediately with default size
        assert len(blocks1) == 1
        assert blocks1[0].block_id == "minecraft:stone"
        assert blocks1[0].size == (1, 1, 1)  # Default

    def test_updates_when_size_arrives(self, parser):
        """Should re-emit when size becomes available"""
        # First feed - block type only (incomplete)
        code1 = 'stone = Block("minecraft:stone"'
        blocks1 = parser.feed(code1)
        assert len(blocks1) == 1
        assert blocks1[0].size == (1, 1, 1)  # Default

        # Second feed - full accumulated code with size now visible
        # (harness passes full accumulated code, not just delta)
        code2 = 'stone = Block("minecraft:stone", size=(10, 5, 10), catalog=catalog)'
        blocks2 = parser.feed(code2)

        # Should re-emit with updated size
        assert len(blocks2) == 1
        assert blocks2[0].size == (10, 5, 10)

    def test_updates_when_position_arrives(self, parser):
        """Should re-emit when position.set() is parsed"""
        # Complete block
        code1 = 'stone = Block("minecraft:stone", size=(5, 5, 5), catalog=catalog)\n'
        blocks1 = parser.feed(code1)
        assert len(blocks1) == 1
        assert parser.blocks["stone"].position == (0.0, 0.0, 0.0)  # Default

        # Position set
        code2 = 'stone.position.set(10, 20, 30)'
        blocks2 = parser.feed(code2)

        # Should re-emit with updated position
        assert len(blocks2) == 1
        assert blocks2[0].position == (10.0, 20.0, 30.0)

    def test_no_duplicate_emission_without_changes(self, parser):
        """Should not re-emit if nothing changed"""
        code = 'stone = Block("minecraft:stone", size=(5, 5, 5), catalog=catalog)'
        blocks1 = parser.feed(code)
        assert len(blocks1) == 1

        # Feed same code again - nothing changed
        blocks2 = parser.feed("")
        assert len(blocks2) == 0

    def test_variable_name_in_output(self, parser):
        """Should include variable_name in JSON output for deduplication"""
        code = 'myblock = Block("minecraft:stone", size=(5, 5, 5), catalog=catalog)'
        blocks = parser.feed(code)

        json_output = parser.to_block_json(blocks[0])
        assert json_output["variable_name"] == "myblock"

    def test_parses_inline_block(self, parser):
        """Should parse inline Block() without variable assignment"""
        code = 'scene.add(Block("minecraft:grass_block", size=(16, 1, 16), catalog=catalog))'
        blocks = parser.feed(code)

        assert len(blocks) == 1
        assert blocks[0].block_id == "minecraft:grass_block"
        assert blocks[0].size == (16, 1, 16)
        assert blocks[0].variable_name.startswith("_inline_")

    def test_parses_multiline_block(self, parser):
        """Should parse Block() split across multiple lines"""
        code = '''wall = Block(
    "minecraft:stone_bricks",
    size=(10, 4, 1),
    catalog=catalog,
)'''
        blocks = parser.feed(code)

        assert len(blocks) == 1
        assert blocks[0].block_id == "minecraft:stone_bricks"
        assert blocks[0].size == (10, 4, 1)

    def test_parses_multiple_blocks_in_sequence(self, parser):
        """Should parse multiple blocks as they appear in code"""
        code = '''scene.add(Block(
    "minecraft:grass_block",
    size=(16, 1, 16),
    catalog=catalog,
))

wall = Block(
    "minecraft:stone_bricks",
    size=(10, 4, 1),
    catalog=catalog,
)
wall.position.set(3, 1, 5)
scene.add(wall)'''

        blocks = parser.feed(code)

        assert len(blocks) == 2
        # One inline, one assigned
        block_ids = {b.block_id for b in blocks}
        assert "minecraft:grass_block" in block_ids
        assert "minecraft:stone_bricks" in block_ids

        # The assigned one should have position
        wall_block = next(b for b in blocks if b.block_id == "minecraft:stone_bricks")
        assert wall_block.position == (3.0, 1.0, 5.0)
        assert wall_block.variable_name == "wall"
