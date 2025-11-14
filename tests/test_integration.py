"""Integration tests covering the main REST API endpoints."""
from __future__ import annotations

import json

import pytest

from backend.app import create_app


@pytest.fixture()
def client(tmp_path):
    db_path = tmp_path / 'test.db'
    app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path}'})
    with app.test_client() as client:
        yield client


def test_login_flow(client):
    payload = {'username': 'tester', 'password': 'secret', 'register': True}
    resp = client.post('/api/login', json=payload)
    assert resp.status_code == 200
    token = resp.get_json()['token']
    assert token
    resp = client.post('/api/login', json={'username': 'tester', 'password': 'secret'})
    assert resp.status_code == 200


def test_strategy_crud(client):
    create = client.post('/api/strategies', json={'name': 'Mean Reversion', 'parameters': json.dumps({'window': 20})})
    assert create.status_code == 200
    strategy_id = create.get_json()['id']
    listing = client.get('/api/strategies')
    assert listing.status_code == 200
    assert any(item['id'] == strategy_id for item in listing.get_json())
    update = client.put(f'/api/strategies/{strategy_id}', json={'name': 'Momentum', 'parameters': json.dumps({'window': 10})})
    assert update.status_code == 200
    delete = client.delete(f'/api/strategies/{strategy_id}')
    assert delete.status_code == 200


def test_market_data_and_orders(client):
    market = client.get('/api/market-data')
    assert market.status_code == 200
    data = market.get_json()
    assert 'summary' in data and 'ticks' in data
    order = client.post('/api/orders', json={'symbol': 'EURUSD', 'side': 'BUY', 'volume': 0.1})
    assert order.status_code == 200
    trades = client.get('/api/trades')
    assert trades.status_code == 200
    assert len(trades.get_json()) >= 1


def test_risk_and_health(client):
    risk = client.get('/api/risk-settings')
    assert risk.status_code == 200
    update = client.post('/api/risk-settings', json={'max_drawdown': 5.5, 'max_position_size': 2.0})
    assert update.status_code == 200
    updated = client.get('/api/risk-settings')
    assert updated.get_json()['max_drawdown'] == 5.5
    health = client.get('/api/health')
    assert health.status_code == 200


def test_ml_explain(client):
    ml_resp = client.get('/api/ml/explain')
    assert ml_resp.status_code == 200
    body = ml_resp.get_json()
    assert 'return' in body and 'volume' in body
