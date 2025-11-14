"""Tiny subset of joblib for persistence using pickle."""
from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any


def dump(obj: Any, filename: str | Path) -> None:
    path = Path(filename)
    with path.open('wb') as fh:
        pickle.dump(obj, fh)


def load(filename: str | Path) -> Any:
    path = Path(filename)
    with path.open('rb') as fh:
        return pickle.load(fh)
