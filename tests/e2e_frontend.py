"""Build and serve the real React bundle for isolated local Playwright tests."""

from __future__ import annotations

import os
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "warehouse-management-front-end"
BUILD = FRONTEND / "build"
if os.environ.get("E2E_ALLOW_WRITES") != "1" or os.environ.get("E2E_TARGET") != "local":
    raise SystemExit("Local E2E frontend requires explicit write opt-in")
if any(os.environ.get(name) for name in ("DATABASE_URL", "DB_HOST", "DB_NAME")):
    raise SystemExit("Unset database environment variables before local E2E")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BUILD), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/warehouse-management":
            path = "/"
        elif path.startswith("/warehouse-management/"):
            path = path[len("/warehouse-management"):]
        target = (BUILD / path.lstrip("/")).resolve()
        if not target.is_relative_to(BUILD.resolve()) or not target.is_file():
            path = "/index.html"
        self.path = path
        super().do_GET()


if __name__ == "__main__":
    environment = os.environ.copy()
    environment["REACT_APP_API_URL"] = "http://127.0.0.1:5107/api"
    environment["BROWSER"] = "none"
    subprocess.run(["npm.cmd" if os.name == "nt" else "npm", "run", "build"],
                   cwd=FRONTEND, env=environment, check=True)
    ThreadingHTTPServer(("127.0.0.1", 3107), Handler).serve_forever()
