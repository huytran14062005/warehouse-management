from web import app


if __name__ == "__main__":
    if app.config["IS_PRODUCTION"]:
        raise RuntimeError("Use a production application server instead of the development server")
    from web.realtime import socketio
    socketio.run(app, host="0.0.0.0", port=5000, debug=app.debug, allow_unsafe_werkzeug=True)
