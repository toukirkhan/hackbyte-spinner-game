#!/usr/bin/env python3
"""
HackByte 4.0 — Roulette Spinner App Backend
Simple HTTP server that serves the frontend and manages participants/winners via JSON files.
Run: python server.py
Then open: http://localhost:8000
"""

import json
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PARTICIPANTS_FILE = os.path.join(DATA_DIR, "participants.json")
WINNERS_FILE = os.path.join(DATA_DIR, "winners.json")
PORT = 8000

MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon",
}


def ensure_data_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    for path in (PARTICIPANTS_FILE, WINNERS_FILE):
        if not os.path.exists(path):
            with open(path, "w") as f:
                json.dump([], f)


def read_json(path):
    with open(path, "r") as f:
        return json.load(f)


def write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


class SpinnerHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[{self.address_string()}] {fmt % args}")

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, code, message):
        self.send_json(code, {"error": message})

    def read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length else b""

    # ------------------------------------------------------------------
    # OPTIONS (pre-flight)
    # ------------------------------------------------------------------
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    # ------------------------------------------------------------------
    # GET
    # ------------------------------------------------------------------
    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/participants":
            data = read_json(PARTICIPANTS_FILE)
            self.send_json(200, data)
            return

        if path == "/winners":
            data = read_json(WINNERS_FILE)
            self.send_json(200, data)
            return

        # Serve static files
        if path == "/" or path == "":
            path = "/index.html"

        # Map URL path to filesystem path (only serve files in the project root)
        rel = path.lstrip("/")
        file_path = os.path.join(os.path.dirname(__file__), rel)
        # Prevent directory traversal
        file_path = os.path.realpath(file_path)
        base_dir = os.path.realpath(os.path.dirname(__file__))
        if not file_path.startswith(base_dir):
            self.send_error_json(403, "Forbidden")
            return

        if os.path.isfile(file_path):
            _, ext = os.path.splitext(file_path)
            mime = MIME_TYPES.get(ext.lower(), "application/octet-stream")
            with open(file_path, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(body)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error_json(404, "Not found")

    # ------------------------------------------------------------------
    # POST
    # ------------------------------------------------------------------
    def do_POST(self):
        path = self.path.split("?")[0]

        if path == "/participants":
            try:
                body = json.loads(self.read_body())
                username = body.get("username", "").strip()
            except (json.JSONDecodeError, AttributeError):
                self.send_error_json(400, "Invalid JSON body")
                return

            if not username:
                self.send_error_json(400, "username is required")
                return

            participants = read_json(PARTICIPANTS_FILE)
            if username not in participants:
                participants.append(username)
                write_json(PARTICIPANTS_FILE, participants)

            self.send_json(200, participants)
            return

        if path == "/winners":
            try:
                body = json.loads(self.read_body())
                username = body.get("username", "").strip()
            except (json.JSONDecodeError, AttributeError):
                self.send_error_json(400, "Invalid JSON body")
                return

            if not username:
                self.send_error_json(400, "username is required")
                return

            winners = read_json(WINNERS_FILE)
            if username not in winners:
                winners.append(username)
                write_json(WINNERS_FILE, winners)

            self.send_json(200, winners)
            return

        self.send_error_json(404, "Not found")

    # ------------------------------------------------------------------
    # DELETE
    # ------------------------------------------------------------------
    def do_DELETE(self):
        path = self.path.split("?")[0]

        m = re.match(r"^/participants/(.+)$", path)
        if m:
            username = m.group(1)
            participants = read_json(PARTICIPANTS_FILE)
            participants = [p for p in participants if p != username]
            write_json(PARTICIPANTS_FILE, participants)
            self.send_json(200, participants)
            return

        self.send_error_json(404, "Not found")


if __name__ == "__main__":
    ensure_data_files()
    server = HTTPServer(("127.0.0.1", PORT), SpinnerHandler)
    print(f"🎡 HackByte Spinner running at http://localhost:{PORT}")
    print("   Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped.")
