"""Simple pipeline chaining helper."""
from __future__ import annotations

from typing import List, Tuple


class Pipeline:
    def __init__(self, steps: List[Tuple[str, object]]):
        self.steps = steps

    def fit(self, X, y):
        data = X
        for name, step in self.steps[:-1]:
            data = step.fit_transform(data)
        final_name, final_step = self.steps[-1]
        final_step.fit(data, y)
        self.steps[-1] = (final_name, final_step)
        return self

    def predict(self, X):
        data = X
        for name, step in self.steps[:-1]:
            data = step.transform(data)
        return self.steps[-1][1].predict(data)

    @property
    def named_steps(self):
        return {name: step for name, step in self.steps}
