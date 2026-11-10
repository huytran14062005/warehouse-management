"""Run isolated E2E services and Playwright, then stop only those services."""

from __future__ import annotations

import os
import secrets
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "warehouse-management-front-end"
RESULTS = FRONTEND / "test-results"
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def ready(url: str, timeout: int, process: subprocess.Popen) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Test server exited before readiness: {url}")
        try:
            with urlopen(url, timeout=2):
                return
        except HTTPError as error:
            if error.code == 401:
                return
        except (URLError, TimeoutError):
            pass
        time.sleep(0.3)
    raise RuntimeError(f"Test server did not become ready: {url}")


def stop(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def main() -> int:
    if os.environ.get("E2E_ALLOW_WRITES") != "1" or os.environ.get("E2E_TARGET") != "local":
        raise SystemExit("Set E2E_ALLOW_WRITES=1 and E2E_TARGET=local explicitly")
    if any(os.environ.get(key) for key in ("DATABASE_URL", "DB_HOST", "DB_NAME")):
        raise SystemExit("Unset DATABASE_URL, DB_HOST and DB_NAME before local E2E")
    for port in (5107, 3107):
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                raise SystemExit(f"Port {port} is already in use; refusing to reuse a server")
    if not PYTHON.is_file():
        raise SystemExit("Missing .venv Python; install backend dependencies first")

    run_id = secrets.token_hex(12)
    environment = os.environ.copy()
    environment["E2E_RUN_ID"] = run_id
    environment["E2E_EXTERNAL_SERVERS"] = "1"
    environment["APP_ENV"] = "test"
    RESULTS.mkdir(exist_ok=True)
    print(f"Local E2E run ID: {run_id}", flush=True)
    processes = []
    with (RESULTS / "e2e-backend.log").open("w", encoding="utf-8") as backend_log, \
         (RESULTS / "e2e-frontend.log").open("w", encoding="utf-8") as frontend_log:
        try:
            backend = subprocess.Popen(
                [str(PYTHON), str(ROOT / "tests" / "e2e_server.py")],
                cwd=ROOT, env=environment, stdout=backend_log,
                stderr=subprocess.STDOUT,
            )
            processes.append(backend)
            ready("http://127.0.0.1:5107/api/products/inventory", 30, backend)
            frontend = subprocess.Popen(
                [str(PYTHON), str(ROOT / "tests" / "e2e_frontend.py")],
                cwd=ROOT, env=environment, stdout=frontend_log,
                stderr=subprocess.STDOUT,
            )
            processes.append(frontend)
            ready("http://127.0.0.1:3107/warehouse-management/login", 180, frontend)
            command = ["node", "node_modules/@playwright/test/cli.js", "test",
                       "-c", "playwright.config.cjs", *sys.argv[1:]]
            return subprocess.run(command, cwd=FRONTEND, env=environment,
                                  check=False).returncode
        finally:
            for process in reversed(processes):
                stop(process)


if __name__ == "__main__":
    sys.exit(main())
