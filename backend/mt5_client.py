"""MT5 client abstraction with automatic simulation fallback.

This module tries to use the official MetaTrader5 package if available.
If the environment cannot connect (common in CI), the client switches to a
simulation mode that generates synthetic ticks and fake order responses so
that the rest of the stack remains functional.
"""
from __future__ import annotations

import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List

try:  # Import MetaTrader5 lazily so the project works without it
    import MetaTrader5 as mt5  # type: ignore
except Exception:  # pragma: no cover - handled via simulation
    mt5 = None


@dataclass
class Tick:
    """Simple dataclass to represent a market tick."""

    symbol: str
    bid: float
    ask: float
    time: datetime


class MT5Client:
    """Encapsulates MetaTrader5 connection logic with graceful fallback."""

    def __init__(self) -> None:
        self.login = os.getenv('MT5_LOGIN')
        self.password = os.getenv('MT5_PASSWORD')
        self.server = os.getenv('MT5_SERVER')
        self.path = os.getenv('MT5_PATH')
        self.simulation_mode = False
        self.connected = False
        self.symbols = ['EURUSD', 'USDJPY', 'GBPUSD']
        self._connect()

    def _connect(self) -> None:
        """Attempt a connection and fall back to simulation when needed."""
        if mt5 is None:
            self.simulation_mode = True
            return
        if self.login and self.password and self.server:
            try:
                if not mt5.initialize(path=self.path):
                    raise RuntimeError('Failed to initialize MetaTrader5 terminal.')
                if not mt5.login(int(self.login), password=self.password, server=self.server):
                    raise RuntimeError('Failed to login with provided credentials.')
                self.connected = True
            except Exception:
                self.simulation_mode = True
        else:
            self.simulation_mode = True

    def get_market_data(self) -> Dict[str, List[Dict[str, float]]]:
        """Return current market snapshot for the configured symbols."""
        if self.simulation_mode or mt5 is None:
            return self._generate_fake_market()
        ticks: List[Dict[str, float]] = []
        for symbol in self.symbols:
            tick_info = mt5.symbol_info_tick(symbol)
            if not tick_info:
                continue
            ticks.append(
                {
                    'symbol': symbol,
                    'bid': float(tick_info.bid),
                    'ask': float(tick_info.ask),
                    'time': datetime.fromtimestamp(tick_info.time_msc / 1000).isoformat(),
                }
            )
        summary = [
            {'symbol': item['symbol'], 'price': (item['bid'] + item['ask']) / 2}
            for item in ticks
        ]
        return {'summary': summary, 'ticks': ticks}

    def place_order(self, symbol: str, side: str, volume: float) -> Dict[str, float]:
        """Place an order using MT5 or fake a fill."""
        side = side.upper()
        if side not in {'BUY', 'SELL'}:
            raise ValueError('Side must be BUY or SELL')
        if self.simulation_mode or mt5 is None:
            price = self._random_price(symbol)
            return {
                'symbol': symbol,
                'side': side,
                'volume': volume,
                'price': price,
                'time': datetime.utcnow().isoformat(),
            }
        request = {
            'action': mt5.TRADE_ACTION_DEAL,
            'symbol': symbol,
            'volume': volume,
            'type': mt5.ORDER_TYPE_BUY if side == 'BUY' else mt5.ORDER_TYPE_SELL,
            'price': mt5.symbol_info_tick(symbol).ask,
            'deviation': 10,
            'magic': 234000,
            'comment': 'Flask bot order',
            'type_time': mt5.ORDER_TIME_GTC,
            'type_filling': mt5.ORDER_FILLING_RETURN,
        }
        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            raise RuntimeError(f'MT5 order failed: {result}')
        return {
            'symbol': symbol,
            'side': side,
            'volume': volume,
            'price': float(result.price),
            'time': datetime.utcnow().isoformat(),
        }

    def _generate_fake_market(self) -> Dict[str, List[Dict[str, float]]]:
        """Produce deterministic but random-looking ticks."""
        ticks = []
        now = datetime.utcnow()
        for idx, symbol in enumerate(self.symbols):
            base = 1.05 + idx * 0.1
            bid = base + random.uniform(-0.005, 0.005)
            ask = bid + 0.0005
            ticks.append(
                {
                    'symbol': symbol,
                    'bid': bid,
                    'ask': ask,
                    'time': (now - timedelta(seconds=idx * 3)).isoformat(),
                }
            )
        summary = [
            {'symbol': tick['symbol'], 'price': round((tick['bid'] + tick['ask']) / 2, 5)}
            for tick in ticks
        ]
        return {'summary': summary, 'ticks': ticks}

    def _random_price(self, symbol: str) -> float:
        """Generate a pseudo price per symbol to simulate fills."""
        seed = sum(ord(c) for c in symbol)
        random.seed(seed)
        return round(1.0 + random.random(), 5)


mt5_client = MT5Client()
