#!/usr/bin/env python3
"""Tiny static dev server for Comet Karts.

Serves the game folder with caching disabled so edited JS/track files
always load fresh (no stale-module surprises). Usage:

    python serve.py [port]      # default port 8788
"""
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    # ES module graphs pull many files over parallel keep-alive
    # connections; a threading server keeps them from blocking.
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8788
    print(f'Comet Karts running at http://localhost:{port}/')
    srv = ThreadingHTTPServer(('0.0.0.0', port), NoCacheHandler)
    srv.daemon_threads = True
    srv.serve_forever()
