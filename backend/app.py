from flask import Flask, jsonify, send_from_directory
import os

app = Flask(__name__, static_folder=None)

@app.route('/api/games')
def list_games():
    consoles = {}
    base = "roms"
    if not os.path.exists(base):
        return jsonify(consoles)
    for system in os.listdir(base):
        path = os.path.join(base, system)
        if os.path.isdir(path):
            consoles[system] = sorted(os.listdir(path))
    return jsonify(consoles)

# Simple endpoint to serve rom files if needed (frontend may fetch /roms/<system>/<file>)
@app.route('/roms/<system>/<path:filename>')
def rom_file(system, filename):
    directory = os.path.join("roms", system)
    if os.path.exists(os.path.join(directory, filename)):
        return send_from_directory(directory, filename)
    return ("Not Found", 404)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
