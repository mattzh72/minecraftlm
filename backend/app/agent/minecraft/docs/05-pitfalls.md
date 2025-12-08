# Common Pitfalls

- `minecraft:grass_block` has only `snowy=true|false` blockstates in the assets. Always set `properties={"snowy": "false"}` for normal grass or the block may render as missing.
- Block ids are validated. Typos such as `minecraft:gras_block` raise `ValueError` when constructing `Block`; check against `BlockCatalog.block_ids` if unsure.
- `start` is inclusive and `end` is exclusive in the exported structure. Off-by-one errors can leave gaps or overlap; double-check sizes vs. positions.
