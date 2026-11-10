"""Remove only one generated local E2E database and its fixture manifest."""

from __future__ import annotations

import re
import sys
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parent / ".e2e-data"


def main() -> None:
    if len(sys.argv) != 2 or not re.fullmatch(r"[a-f0-9]{16,40}", sys.argv[1]):
        raise SystemExit("Usage: python tests/e2e_cleanup.py <E2E_RUN_ID (hex)>")
    run_id = sys.argv[1]
    for suffix in (".sqlite", ".json"):
        target = DATA_DIR / f"{run_id}{suffix}"
        if not target.is_file() or target.parent.resolve() != DATA_DIR.resolve():
            continue
        target.unlink()
        print(f"Removed {target.name}")


if __name__ == "__main__":
    main()
