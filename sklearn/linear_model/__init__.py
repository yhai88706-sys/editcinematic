"""Simplified implementation of LogisticRegression."""
from __future__ import annotations

import math
from typing import List


class LogisticRegression:
    def __init__(self, max_iter: int = 1000, learning_rate: float = 0.1):
        self.max_iter = max_iter
        self.learning_rate = learning_rate
        self.coef_: List[List[float]] | None = None
        self._weights: List[float] | None = None
        self.intercept_: float = 0.0

    def fit(self, X: List[List[float]], y: List[int]) -> 'LogisticRegression':
        n_features = len(X[0])
        weights = [0.0] * n_features
        self.intercept_ = 0.0
        for _ in range(self.max_iter):
            grad_w = [0.0] * n_features
            grad_b = 0.0
            for features, target in zip(X, y):
                z = sum(w * f for w, f in zip(weights, features)) + self.intercept_
                pred = 1 / (1 + math.exp(-z))
                error = pred - target
                for idx in range(n_features):
                    grad_w[idx] += error * features[idx]
                grad_b += error
            for idx in range(n_features):
                weights[idx] -= self.learning_rate * grad_w[idx] / len(X)
            self.intercept_ -= self.learning_rate * grad_b / len(X)
        self._weights = weights
        self.coef_ = [weights.copy()]
        return self

    def predict(self, X: List[List[float]]) -> List[int]:
        assert self._weights is not None, 'Model must be fit before predicting'
        preds: List[int] = []
        for features in X:
            z = sum(w * f for w, f in zip(self._weights, features)) + self.intercept_
            prob = 1 / (1 + math.exp(-z))
            preds.append(1 if prob >= 0.5 else 0)
        return preds
