"""Backend package initializer for the MT5 project."""
from .app import create_app, app  # re-export for convenience

__all__ = ['create_app', 'app']
