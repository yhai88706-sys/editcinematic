"""Minimal Flask-compatible interface for offline execution.

This lightweight implementation mimics enough of Flask's API so the project can
run in restricted environments where installing external packages is not
possible. It supports routing, JSON helpers, contexts, and a test client.
"""
from __future__ import annotations

import json
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, Tuple


@dataclass
class _Request:
    json_data: Any = None
    method: str = 'GET'

    def get_json(self) -> Any:
        return self.json_data

    def _set_json(self, value: Any) -> None:
        self.json_data = value


request = _Request()


class Response:
    """Simple HTTP response container."""

    def __init__(self, data: Any, status: int = 200):
        if isinstance(data, Response):
            self.data = data.data
        else:
            self.data = json.dumps(data)
        self.status_code = status

    def get_json(self) -> Any:
        return json.loads(self.data)


def jsonify(data: Any) -> Response:
    return Response(data, 200)


class Flask:
    """Tiny Flask clone used for testing and demos."""

    def __init__(self, name: str):
        self.name = name
        self.config: Dict[str, Any] = {}
        self._routes = []

    def route(self, rule: str, methods: Iterable[str] | None = None) -> Callable:
        methods = [m.upper() for m in (methods or ['GET'])]

        def decorator(func: Callable) -> Callable:
            self._routes.append({'rule': rule, 'methods': methods, 'func': func})
            return func

        return decorator

    def test_client(self) -> '_TestClient':
        return _TestClient(self)

    @contextmanager
    def app_context(self):
        yield self

    def run(self, host: str = '127.0.0.1', port: int = 5000):  # pragma: no cover
        from wsgiref.simple_server import make_server

        def app(environ, start_response):
            path = environ.get('PATH_INFO', '/')
            method = environ.get('REQUEST_METHOD', 'GET').upper()
            match = self._match_route(path, method)
            if not match:
                resp = Response({'error': 'Not found'}, status=404)
            else:
                handler, kwargs = match
                resp = _normalize(handler(**kwargs))
            start_response(f"{resp.status_code} OK", [('Content-Type', 'application/json')])
            return [resp.data.encode()]

        with make_server(host, port, app) as server:
            print(f"* Running development server at http://{host}:{port}")
            server.serve_forever()

    def _match_route(self, path: str, method: str):
        path_parts = [part for part in path.strip('/').split('/') if part]
        for route in self._routes:
            if method not in route['methods']:
                continue
            rule_parts = [part for part in route['rule'].strip('/').split('/') if part]
            if len(rule_parts) != len(path_parts):
                continue
            params = {}
            for rule_part, path_part in zip(rule_parts, path_parts):
                if rule_part.startswith('<') and rule_part.endswith('>'):
                    content = rule_part[1:-1]
                    if ':' in content:
                        type_name, param_name = content.split(':', 1)
                    else:
                        type_name, param_name = 'string', content
                    if type_name == 'int':
                        params[param_name] = int(path_part)
                    else:
                        params[param_name] = path_part
                elif rule_part != path_part:
                    break
            else:
                return route['func'], params
        return None


class _TestClient:
    def __init__(self, app: Flask):
        self.app = app

    def __enter__(self) -> '_TestClient':
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        pass

    def open(self, path: str, method: str = 'GET', json: Any | None = None) -> Response:
        request._set_json(json)
        request.method = method.upper()
        match = self.app._match_route(path, method.upper())
        if not match:
            resp = Response({'error': 'Not found'}, status=404)
        else:
            handler, kwargs = match
            resp = _normalize(handler(**kwargs))
        request._set_json(None)
        request.method = 'GET'
        return resp

    def get(self, path: str) -> Response:
        return self.open(path, 'GET')

    def post(self, path: str, json: Any | None = None) -> Response:
        return self.open(path, 'POST', json=json)

    def put(self, path: str, json: Any | None = None) -> Response:
        return self.open(path, 'PUT', json=json)

    def delete(self, path: str) -> Response:
        return self.open(path, 'DELETE')


def _normalize(result: Any) -> Response:
    if isinstance(result, tuple):
        data, status = result
        resp = data if isinstance(data, Response) else Response(data)
        resp.status_code = status
        return resp
    if isinstance(result, Response):
        return result
    return Response(result)
