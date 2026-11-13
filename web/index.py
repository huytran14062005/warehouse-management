from pathlib import Path
import sys


if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from web import app
from web.realtime import socketio


if __name__ == "__main__":
    if app.config["IS_PRODUCTION"]:
        raise RuntimeError("Use a production application server instead of the development server")
    socketio.run(app, host="0.0.0.0", port=5000, debug=app.debug, allow_unsafe_werkzeug=True)