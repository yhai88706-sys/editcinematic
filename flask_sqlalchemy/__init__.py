"""Minimal subset of Flask-SQLAlchemy for offline testing."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List


class Column:
    def __init__(self, column_type: Any, primary_key: bool = False, default: Any = None, nullable: bool = True, **_):
        self.type = column_type
        self.primary_key = primary_key
        self.default = default
        self.nullable = nullable
        self.name: str | None = None


class Integer:
    pass


class String:
    def __init__(self, length: int):
        self.length = length


class Text:
    pass


class Float:
    pass


class DateTime:
    pass


class _QueryDescriptor:
    def __get__(self, instance, owner):
        return Query(owner)


class Query:
    def __init__(self, model):
        self.model = model
        self._data = list(getattr(model, '_storage', []))

    def filter_by(self, **kwargs):
        self._data = [obj for obj in self._data if all(getattr(obj, key) == value for key, value in kwargs.items())]
        return self

    def first(self):
        return self._data[0] if self._data else None

    def all(self):
        return list(self._data)


class _Session:
    def __init__(self, db: 'SQLAlchemy'):
        self.db = db

    def add(self, obj):
        storage = obj.__class__._storage
        if getattr(obj, 'id', None) is None:
            obj.id = obj.__class__._next_id
            obj.__class__._next_id += 1
        storage.append(obj)

    def delete(self, obj):
        storage = obj.__class__._storage
        obj.__class__._storage = [item for item in storage if item.id != obj.id]

    def commit(self):
        pass


class SQLAlchemy:
    def __init__(self):
        self.Model = self._create_model_base()
        self.session = _Session(self)
        self._models: List[type] = []
        self.Column = Column
        self.Integer = Integer
        self.String = String
        self.Text = Text
        self.Float = Float
        self.DateTime = DateTime

    def init_app(self, app):
        self.app = app

    def create_all(self):
        for model in self._models:
            model._storage = []
            model._next_id = 1

    def _create_model_base(self):
        db = self

        class Model(metaclass=_ModelMeta):
            _db = db
            id = Column(Integer, primary_key=True)
            query = _QueryDescriptor()

            def __init__(self, **kwargs):
                for name, column in self._columns.items():
                    if name == 'id':
                        continue
                    value = kwargs.get(name)
                    if value is None:
                        default = column.default() if callable(column.default) else column.default
                        value = default
                    setattr(self, name, value)

        return Model


class _ModelMeta(type):
    def __new__(mcls, name, bases, attrs):
        columns = {key: value for key, value in list(attrs.items()) if isinstance(value, Column)}
        for key in columns:
            attrs.pop(key)
        cls = super().__new__(mcls, name, bases, attrs)
        base_columns = {}
        for base in bases:
            base_columns.update(getattr(base, '_columns', {}))
        columns = {**base_columns, **columns}
        cls._columns = columns
        for col_name, column in columns.items():
            column.name = col_name
        cls._storage: List[Any] = []
        cls._next_id = 1
        if name != 'Model':
            cls._db._models.append(cls)
        return cls
