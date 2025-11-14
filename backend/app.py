"""Flask REST API powering the MT5 trading dashboard."""
from __future__ import annotations

import json
import os
import secrets
from datetime import datetime
from pathlib import Path
from typing import Dict

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import hashlib

from .mt5_client import mt5_client
from .ml_model import explain_model

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / 'data'
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / 'trading.db'

db = SQLAlchemy()


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    token = db.Column(db.String(64), nullable=True)


class Strategy(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    parameters = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Trade(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(20), nullable=False)
    side = db.Column(db.String(4), nullable=False)
    volume = db.Column(db.Float, nullable=False)
    price = db.Column(db.Float, nullable=False)
    time = db.Column(db.DateTime, default=datetime.utcnow)


class RiskSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    max_drawdown = db.Column(db.Float, default=10.0)
    max_position_size = db.Column(db.Float, default=1.0)


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _verify_password(hashed: str, password: str) -> bool:
    return hashed == _hash_password(password)


def create_app(test_config: Dict | None = None) -> Flask:
    """Application factory to ease testing."""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_PATH}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    if test_config:
        app.config.update(test_config)
    db.init_app(app)
    CORS(app)

    with app.app_context():
        db.create_all()
        if not RiskSetting.query.first():
            db.session.add(RiskSetting())
            db.session.commit()

    @app.route('/api/login', methods=['POST'])
    def login():
        payload = request.get_json() or {}
        username = payload.get('username')
        password = payload.get('password')
        register = payload.get('register')
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        user = User.query.filter_by(username=username).first()
        if register:
            if user:
                return jsonify({'error': 'User already exists'}), 400
            user = User(
                username=username,
                password_hash=_hash_password(password),
                token=secrets.token_hex(16),
            )
            db.session.add(user)
            db.session.commit()
            return jsonify({'username': user.username, 'token': user.token})
        if not user or not _verify_password(user.password_hash, password):
            return jsonify({'error': 'Invalid credentials'}), 401
        if not user.token:
            user.token = secrets.token_hex(16)
            db.session.commit()
        return jsonify({'username': user.username, 'token': user.token})

    @app.route('/api/strategies', methods=['GET', 'POST'])
    def strategies():
        if request.method == 'POST':
            payload = request.get_json() or {}
            try:
                json.loads(payload.get('parameters', '{}'))
            except json.JSONDecodeError:
                return jsonify({'error': 'Parameters must be valid JSON'}), 400
            strategy = Strategy(name=payload.get('name', 'Unnamed'), parameters=payload['parameters'])
            db.session.add(strategy)
            db.session.commit()
            return jsonify({'id': strategy.id, 'name': strategy.name, 'parameters': strategy.parameters})
        all_strategies = sorted(Strategy.query.all(), key=lambda s: s.created_at, reverse=True)
        return jsonify([
            {'id': s.id, 'name': s.name, 'parameters': s.parameters, 'created_at': s.created_at.isoformat()}
            for s in all_strategies
        ])

    @app.route('/api/strategies/<int:strategy_id>', methods=['PUT', 'DELETE'])
    def strategy_detail(strategy_id: int):
        strategy = Strategy.query.filter_by(id=strategy_id).first()
        if not strategy:
            return jsonify({'error': 'Strategy not found'}), 404
        if request.method == 'DELETE':
            db.session.delete(strategy)
            db.session.commit()
            return jsonify({'status': 'deleted'})
        payload = request.get_json() or {}
        if 'name' in payload:
            strategy.name = payload['name']
        if 'parameters' in payload:
            try:
                json.loads(payload['parameters'])
            except json.JSONDecodeError:
                return jsonify({'error': 'Parameters must be valid JSON'}), 400
            strategy.parameters = payload['parameters']
        db.session.commit()
        return jsonify({'id': strategy.id, 'name': strategy.name, 'parameters': strategy.parameters})

    @app.route('/api/market-data', methods=['GET'])
    def market_data():
        return jsonify(mt5_client.get_market_data())

    @app.route('/api/orders', methods=['POST'])
    def orders():
        payload = request.get_json() or {}
        symbol = payload.get('symbol', 'EURUSD')
        side = payload.get('side', 'BUY')
        volume = float(payload.get('volume', 0.1))
        try:
            order = mt5_client.place_order(symbol=symbol, side=side, volume=volume)
        except Exception as exc:  # Provide readable error response
            return jsonify({'error': str(exc)}), 400
        trade = Trade(symbol=order['symbol'], side=order['side'], volume=order['volume'], price=order['price'])
        db.session.add(trade)
        db.session.commit()
        return jsonify({
            'id': trade.id,
            'symbol': trade.symbol,
            'side': trade.side,
            'volume': trade.volume,
            'price': trade.price,
            'time': trade.time.isoformat(),
        })

    @app.route('/api/trades', methods=['GET'])
    def trades():
        trades = sorted(Trade.query.all(), key=lambda t: t.time, reverse=True)
        return jsonify([
            {
                'id': t.id,
                'symbol': t.symbol,
                'side': t.side,
                'volume': t.volume,
                'price': t.price,
                'time': t.time.isoformat(),
            }
            for t in trades
        ])

    @app.route('/api/risk-settings', methods=['GET', 'POST'])
    def risk_settings():
        risk = RiskSetting.query.first()
        if request.method == 'POST':
            payload = request.get_json() or {}
            risk.max_drawdown = float(payload.get('max_drawdown', risk.max_drawdown))
            risk.max_position_size = float(payload.get('max_position_size', risk.max_position_size))
            db.session.commit()
        return jsonify({'max_drawdown': risk.max_drawdown, 'max_position_size': risk.max_position_size})

    @app.route('/api/ml/explain', methods=['GET'])
    def ml_explain():
        return jsonify(explain_model())

    @app.route('/api/health', methods=['GET'])
    def health():
        status = 'connected' if not mt5_client.simulation_mode else 'simulation'
        return jsonify({'status': f'Backend OK ({status})'})

    return app


app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
