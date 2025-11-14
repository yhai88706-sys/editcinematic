"""Lightweight price direction classifier using synthetic data.

The model is intentionally simple: we simulate OHLCV data, derive features,
train a logistic regression, and store the fitted pipeline using joblib so the
API can reuse it quickly across requests.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

MODEL_PATH = Path(__file__).resolve().parent / 'price_direction_model.joblib'


def _generate_synthetic_data(rows: int = 500) -> Dict[str, List[float]]:
    """Create synthetic OHLCV data for demonstration purposes."""
    rng = np.random.default_rng(42)
    base_prices = [value + 100 for value in np.cumsum(rng.normal(0, 0.2, rows))]
    high = [bp + delta for bp, delta in zip(base_prices, rng.normal(0.1, 0.05, rows))]
    low = [bp - delta for bp, delta in zip(base_prices, rng.normal(0.1, 0.05, rows))]
    open_price = [bp + delta for bp, delta in zip(base_prices, rng.normal(0, 0.1, rows))]
    close = [bp + delta for bp, delta in zip(base_prices, rng.normal(0, 0.1, rows))]
    volume = rng.integers(100, 1000, rows)
    return {
        'open': open_price,
        'high': high,
        'low': low,
        'close': close,
        'volume': volume,
    }


def _build_features(data: Dict[str, List[float]]) -> List[List[float]]:
    """Convert OHLCV into ML-ready features."""
    close = data['close']
    returns = np.diff(close, prepend=close[0])
    weights = [w / 10 for w in np.ones(10)]
    ma10 = np.convolve(close, weights, mode='same')
    variance = [(c - m) ** 2 for c, m in zip(close, ma10)]
    std10 = np.sqrt(np.convolve(variance, weights, mode='same'))
    features = np.column_stack([returns, ma10, std10, data['volume']])
    return features


def _build_targets(data: Dict[str, List[float]]) -> List[int]:
    """Generate direction labels (1 if next close higher, else 0)."""
    close = data['close']
    shifted = np.roll(close, -1)
    shifted[-1] = close[-1]
    return [1 if s > c else 0 for s, c in zip(shifted, close)]


def train_and_save_model(force: bool = False) -> Pipeline:
    """Train the pipeline and persist it to disk."""
    if MODEL_PATH.exists() and not force:
        return joblib.load(MODEL_PATH)
    data = _generate_synthetic_data()
    X = _build_features(data)
    y = _build_targets(data)
    pipeline = Pipeline(
        steps=[
            ('scaler', StandardScaler()),
            ('clf', LogisticRegression(max_iter=1000)),
        ]
    )
    pipeline.fit(X, y)
    joblib.dump(pipeline, MODEL_PATH)
    return pipeline


def load_model() -> Pipeline:
    """Load the trained model, training on-demand if missing."""
    if not MODEL_PATH.exists():
        return train_and_save_model()
    return joblib.load(MODEL_PATH)


def explain_model() -> Dict[str, float]:
    """Provide coefficient mapping for interpretability."""
    model = load_model()
    clf: LogisticRegression = model.named_steps['clf']
    scaler: StandardScaler = model.named_steps['scaler']
    coefs = clf.coef_[0]
    feature_names = ['return', 'ma10', 'std10', 'volume']
    scaled_coefs = [c / s for c, s in zip(coefs, scaler.scale_)]
    return {name: float(weight) for name, weight in zip(feature_names, scaled_coefs)}


# Train model eagerly when module loads so the API is ready to respond
if os.getenv('TRAIN_ON_IMPORT', '1') == '1':
    train_and_save_model()
