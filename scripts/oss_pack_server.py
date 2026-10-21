"""
車庫証明ツール用 ローカル補助サーバー（行政書士法人フェリス）

- gyosei-dashboard フォルダを http://localhost:8765/ で配信（ツールを開く用）
- 店舗送付パック作成API（DocuWorks・Excel を動かす係）

  GET  /api/oss-pack/ping           環境チェック
  POST /api/oss-pack/request-doc    依頼書（PDF/TIF）を受け取り、ページのサムネイルを返す
  POST /api/oss-pack/build          送付パック（表紙＋依頼書＋所在図＋配置図）を作成
  POST /api/oss-pack/open           作成フォルダ / PDF をエクスプローラ等で開く

起動: python scripts/oss_pack_server.py   （または start_syako_tool.bat）
"""

import base64
import json
import os
import sys
import tempfile
import threading
import traceback
import uuid
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oss_pack_builder as builder  # noqa: E402

PORT = int(os.environ.get('OSS_PACK_PORT', '8765'))
ROOT = builder.BASE_DIR
UPLOAD_DIR = os.path.join(tempfile.gettempdir(), 'oss_pack_uploads')
_uploads = {}          # fileId -> path
_build_lock = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # file:// や別ドメインで開いたツールからも呼べるように
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        if self.path.endswith('.html') or self.path.endswith('.js'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        if '/api/' in (self.path or ''):
            sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n).decode('utf-8') or '{}')

    def do_GET(self):
        if self.path.startswith('/api/oss-pack/ping'):
            issues = builder.check_environment()
            return self._json(200, {'ok': not issues, 'issues': issues, 'outputRoot': builder.OUTPUT_ROOT})
        return super().do_GET()

    def do_POST(self):
        try:
            if self.path.startswith('/api/oss-pack/request-doc'):
                return self._request_doc()
            if self.path.startswith('/api/oss-pack/build'):
                return self._build()
            if self.path.startswith('/api/oss-pack/open'):
                return self._open()
            return self._json(404, {'ok': False, 'error': 'not found'})
        except Exception as e:
            traceback.print_exc()
            return self._json(500, {'ok': False, 'error': str(e)})

    def _request_doc(self):
        req = self._read_json()
        name = req.get('name') or 'request.pdf'
        ext = os.path.splitext(name)[1].lower()
        if ext not in ('.pdf', '.tif', '.tiff'):
            return self._json(400, {'ok': False, 'error': 'PDF または TIF ファイルを選んでください'})
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        file_id = uuid.uuid4().hex
        path = os.path.join(UPLOAD_DIR, file_id + ext)
        with open(path, 'wb') as f:
            f.write(builder.b64_to_bytes(req.get('data')))
        _uploads[file_id] = path
        pages = builder.page_thumbnails(path)
        return self._json(200, {'ok': True, 'fileId': file_id, 'pages': pages, 'kind': 'fax' if ext != '.pdf' else 'pdf'})

    def _build(self):
        data = self._read_json()
        req = data.get('request') or {}
        if req.get('fileId'):
            req['path'] = _uploads.get(req['fileId'])
            data['request'] = req
        with _build_lock:
            res = builder.build_pack(data)
        return self._json(200, {'ok': True, **res})

    def _open(self):
        req = self._read_json()
        path = req.get('path') or ''
        if not path or not os.path.exists(path):
            return self._json(404, {'ok': False, 'error': 'ファイルが見つかりません'})
        if not os.path.abspath(path).startswith(os.path.abspath(builder.OUTPUT_ROOT)):
            return self._json(403, {'ok': False, 'error': '送付フォルダ以外は開けません'})
        os.startfile(path)
        return self._json(200, {'ok': True})


class LoopbackServer(ThreadingHTTPServer):
    daemon_threads = True


def make_servers(handler):
    """LAN には公開せず、ループバック（IPv4 127.0.0.1 / IPv6 ::1）だけで待ち受ける"""
    import socket
    servers = []
    v4 = LoopbackServer(('127.0.0.1', PORT), handler)   # これは必須
    servers.append(v4)
    try:
        class V6(LoopbackServer):
            address_family = socket.AF_INET6
        servers.append(V6(('::1', PORT), handler))
    except OSError:
        pass
    return servers


def main():
    if sys.stdout is None or sys.stderr is None:   # pythonw（ウィンドウなし自動起動）
        log = open(os.path.join(tempfile.gettempdir(), 'oss_pack_server.log'), 'a', encoding='utf-8', buffering=1)
        sys.stdout = sys.stdout or log
        sys.stderr = sys.stderr or log
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(errors='replace')
        except Exception:
            pass
    os.makedirs(builder.OUTPUT_ROOT, exist_ok=True)
    handler = partial(Handler, directory=ROOT)
    servers = make_servers(handler)
    for extra in servers[1:]:
        threading.Thread(target=extra.serve_forever, daemon=True).start()
    srv = servers[0]
    print(f'車庫証明ツール 補助サーバー起動: http://localhost:{PORT}/syako_map_maker.html')
    issues = builder.check_environment()
    if issues:
        print('⚠ 環境チェック:\n  ' + '\n  '.join(issues))
    print(f'送付パック保存先: {builder.OUTPUT_ROOT}')
    print('このウィンドウを閉じるとサーバーが止まります。')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
