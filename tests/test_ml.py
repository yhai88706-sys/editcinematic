"""Unit tests for the ML helper functions."""
from __future__ import annotations

from backend import ml_model


def test_model_training(tmp_path, monkeypatch):
    model_file = tmp_path / 'model.joblib'
    monkeypatch.setattr(ml_model, 'MODEL_PATH', model_file)
    pipeline = ml_model.train_and_save_model(force=True)
    assert model_file.exists()
    preds = pipeline.predict([[0, 0, 0, 100]])
    assert len(preds) == 1


def test_explain_returns_all_features():
    explanation = ml_model.explain_model()
    for key in ['return', 'ma10', 'std10', 'volume']:
        assert key in explanation
