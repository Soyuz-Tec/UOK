from __future__ import annotations

import shutil
import time
from pathlib import Path


def remove_directory_with_retry(
    path: Path,
    *,
    attempts: int = 300,
    delay_seconds: float = 0.1,
) -> None:
    if attempts < 1 or delay_seconds < 0:
        raise ValueError("coverage cleanup retry policy is invalid")
    for attempt in range(attempts):
        try:
            shutil.rmtree(path)
            return
        except FileNotFoundError:
            return
        except PermissionError:
            if attempt + 1 >= attempts:
                if _directory_is_empty(path):
                    return
                raise
            time.sleep(delay_seconds)


def _directory_is_empty(path: Path) -> bool:
    try:
        return path.is_dir() and next(path.iterdir(), None) is None
    except PermissionError:
        return False


__all__ = ["remove_directory_with_retry"]
