"""Simplified StandardScaler implementation."""
from __future__ import annotations

import math
from typing import List


class StandardScaler:
    def __init__(self):
        self.mean_: List[float] | None = None
        self.scale_: List[float] | None = None

    def fit(self, X: List[List[float]]) -> 'StandardScaler':
        n_features = len(X[0])
        sums = [0.0] * n_features
        for row in X:
            for idx, value in enumerate(row):
                sums[idx] += value
        self.mean_ = [s / len(X) for s in sums]
        self.scale_ = []
        for idx in range(n_features):
            variance = sum((row[idx] - self.mean_[idx]) ** 2 for row in X) / len(X)
            self.scale_.append(math.sqrt(variance) or 1.0)
        return self

    def transform(self, X: List[List[float]]) -> List[List[float]]:
        assert self.mean_ is not None and self.scale_ is not None
        transformed: List[List[float]] = []
        for row in X:
            transformed.append([(value - mean) / scale for value, mean, scale in zip(row, self.mean_, self.scale_)])
        return transformed

    def fit_transform(self, X: List[List[float]]) -> List[List[float]]:
        self.fit(X)
        return self.transform(X)
