# Kleiner Entwicklungs-Server ohne Browser-Caching (nur zum Testen noetig).
import http.server

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", 8317), Handler).serve_forever()
