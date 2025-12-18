"""
Async file operations service.

Provides non-blocking file I/O by running operations in a thread pool executor.
Uses singleton pattern to share executor across all callers.
"""

import asyncio
import json
import shutil
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path
from typing import Callable, TypeVar

T = TypeVar("T")


class AsyncFileService:
    """Singleton service for non-blocking file I/O operations."""

    _instance = None

    def __init__(self):
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._loop = asyncio.get_running_loop()

    @property
    def loop(self):
        if not self._loop:
            self._loop = asyncio.get_running_loop()
        return self._loop

    async def _run(self, fn: Callable[..., T], *args: object, **kwargs: object) -> T:
        return await self.loop.run_in_executor(
            self._executor, partial(fn, **kwargs), *args
        )

    async def read_text(self, path: Path) -> str:
        """Read file contents as text."""
        return await self._run(path.read_text)

    async def write_text(self, path: Path, content: str) -> None:
        """Write text content to file."""
        await self._run(path.write_text, content)

    async def write_bytes(self, path: Path, content: bytes) -> None:
        """Write binary content to file."""
        await self._run(path.write_bytes, content)

    async def exists(self, path: Path) -> bool:
        """Check if path exists."""
        return await self._run(path.exists)

    async def is_dir(self, path: Path) -> bool:
        """Check if path is a directory."""
        return await self._run(path.is_dir)

    async def mkdir(
        self, path: Path, parents: bool = False, exist_ok: bool = False
    ) -> None:
        """Create directory."""
        await self._run(lambda: path.mkdir(parents=parents, exist_ok=exist_ok))

    async def rmtree(self, path: Path) -> None:
        """Remove directory tree."""
        await self._run(shutil.rmtree, path)

    async def iterdir(self, path: Path) -> list[Path]:
        """List directory contents."""
        return await self._run(lambda: list(path.iterdir()))

    async def read_json(self, path: Path) -> dict | list:
        """Read and parse JSON file."""
        content = await self.read_text(path)
        return json.loads(content)

    async def write_json(self, path: Path, data: dict | list, indent: int = 2) -> None:
        """Write data as JSON to file."""
        content = json.dumps(data, indent=indent)
        await self.write_text(path, content)


# Module-level singleton accessor
def get_file_service() -> AsyncFileService:
    """Get the singleton AsyncFileService instance."""
    return AsyncFileService()
