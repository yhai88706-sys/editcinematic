"""Stub for flask_cors.CORS."""
from __future__ import annotations

from typing import Any


def CORS(app: Any, *_, **__):
    """No-op decorator to keep API compatibility."""
    return app
