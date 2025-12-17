"""
Async file operations service.

Provides non-blocking file I/O by running operations in a thread pool executor.
Uses singleton pattern to share executor across all callers.
"""

import asyncio
import json
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


class AsyncFileService:
    """Singleton service for non-blocking file I/O operations."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._executor = ThreadPoolExecutor(max_workers=4)
        return cls._instance

    async def read_text(self, path: Path) -> str:
        """Read file contents as text."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, path.read_text)

    async def write_text(self, path: Path, content: str) -> None:
        """Write text content to file."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(self._executor, path.write_text, content)

    async def write_bytes(self, path: Path, content: bytes) -> None:
        """Write binary content to file."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(self._executor, path.write_bytes, content)

    async def exists(self, path: Path) -> bool:
        """Check if path exists."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, path.exists)

    async def is_dir(self, path: Path) -> bool:
        """Check if path is a directory."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, path.is_dir)

    async def mkdir(
        self, path: Path, parents: bool = False, exist_ok: bool = False
    ) -> None:
        """Create directory."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            self._executor, lambda: path.mkdir(parents=parents, exist_ok=exist_ok)
        )

    async def rmtree(self, path: Path) -> None:
        """Remove directory tree."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(self._executor, shutil.rmtree, path)

    async def iterdir(self, path: Path) -> list[Path]:
        """List directory contents."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, lambda: list(path.iterdir()))

    async def read_json(self, path: Path) -> dict | list:
        """Read and parse JSON file."""
        content = await self.read_text(path)
        return json.loads(content)

    async def write_json(
        self, path: Path, data: dict | list, indent: int = 2
    ) -> None:
        """Write data as JSON to file."""
        content = json.dumps(data, indent=indent)
        await self.write_text(path, content)


# Module-level singleton accessor
def get_file_service() -> AsyncFileService:
    """Get the singleton AsyncFileService instance."""
    return AsyncFileService()
