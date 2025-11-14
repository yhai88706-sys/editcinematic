"""Lightweight numpy-inspired helpers for numerical operations."""
from __future__ import annotations

import math
import random as _py_random
from itertools import accumulate
from typing import Iterable, List


class _RNG:
    def __init__(self, seed: int | None = None):
        self.random = _py_random.Random(seed)

    def normal(self, loc: float = 0.0, scale: float = 1.0, size: int = 1) -> List[float]:
        return [self.random.gauss(loc, scale) for _ in range(size)]

    def integers(self, low: int, high: int, size: int = 1) -> List[int]:
        return [self.random.randrange(low, high) for _ in range(size)]


class random_module:
    @staticmethod
    def default_rng(seed: int | None = None) -> _RNG:
        return _RNG(seed)


random = random_module()


def cumsum(values: Iterable[float]) -> List[float]:
    return list(accumulate(values))


def diff(values: List[float], prepend: float | None = None) -> List[float]:
    result: List[float] = []
    prev = prepend if prepend is not None else values[0]
    for value in values:
        result.append(value - prev)
        prev = value
    return result


def ones(length: int) -> List[float]:
    return [1.0] * length


def convolve(values: List[float], kernel: List[float], mode: str = 'same') -> List[float]:
    if mode != 'same':
        raise NotImplementedError('Only same-mode convolution is implemented')
    pad = len(kernel) // 2
    extended = [values[0]] * pad + values + [values[-1]] * pad
    result: List[float] = []
    for i in range(len(values)):
        total = 0.0
        for k, weight in enumerate(kernel):
            total += extended[i + k] * weight
        result.append(total)
    return result


def sqrt(values):
    if isinstance(values, list):
        return [math.sqrt(max(v, 0)) for v in values]
    return math.sqrt(values)


def column_stack(columns: List[List[float]]) -> List[List[float]]:
    return [list(items) for items in zip(*columns)]


def roll(values: List[float], shift: int) -> List[float]:
    n = len(values)
    shift = shift % n
    return values[-shift:] + values[:-shift] if shift else list(values)
