#!/usr/bin/env python3
"""Read-only SQLite integrity and Prisma model/table coverage check."""
from __future__ import annotations

import os
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "prisma" / "schema.prisma"
DB = Path(os.environ.get("TECH360_VERIFY_DB", ROOT / "db" / "custom.db"))

if not DB.is_file():
    print(f"FAIL: database not found: {DB}", file=sys.stderr)
    raise SystemExit(2)

schema_text = SCHEMA.read_text(encoding="utf-8")
models = set(re.findall(r"(?m)^model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{", schema_text))

connection = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
try:
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    foreign_key_violations = connection.execute("PRAGMA foreign_key_check").fetchall()
    tables = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
    }
finally:
    connection.close()

missing_tables = sorted(models - tables)
unexpected_tables = sorted(tables - models)
print(f"database={DB}")
print(f"integrity={integrity}")
print(f"foreign_key_violations={len(foreign_key_violations)}")
print(f"prisma_models={len(models)} sqlite_tables={len(tables)}")
print(f"missing_model_tables={','.join(missing_tables) or 'none'}")
print(f"unexpected_tables={','.join(unexpected_tables) or 'none'}")

if integrity != "ok" or foreign_key_violations or missing_tables or unexpected_tables:
    raise SystemExit(1)
