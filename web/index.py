from pathlib import Path
import sys


if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from web import app


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
