const net = require('net');

const CRLF = '\r\n';
const HEADER_END = '\r\n\r\n';

const ServerNet = ({ name, port, message }) => {

    const res404 = Buffer.from(
        `HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: keep-alive\r\n\r\nNot Found`
    );

    const server = net.createServer((socket) => {
        socket.setNoDelay(true);

        socket.on('error', () => socket.destroy());
        socket.on('timeout', () => socket.destroy());

        let buf = Buffer.allocUnsafe(0);

        socket.on('data', (chunk) => {
            buf = buf.length === 0 ? chunk : Buffer.concat([buf, chunk]);

            let off = 0;

            socket.cork();

            while (true) {
                const lineEnd = buf.indexOf(CRLF, off);
                if (lineEnd === -1) break;

                const requestLine = buf.toString('utf8', off, lineEnd);
                const [method, path ] = requestLine.split(' ');

                if (!method || !path) {
                    socket.write(res404);
                    return socket.destroy();
                }

                const headerEnd = buf.indexOf(HEADER_END, off);
                if (headerEnd === -1) break;

                const headersStr = buf.toString('utf8', lineEnd + 2, headerEnd);

                let contentLength = 0;
                let keepAlive = true;

                const headers = {};

                const lines = headersStr.split(CRLF);

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const idx = line.indexOf(':');
                    if (idx === -1) continue;

                    const key = line.slice(0, idx).trim().toLowerCase();
                    const val = line.slice(idx + 1).trim();

                    headers[key] = val;

                    if (key === 'content-length') {
                        contentLength = parseInt(val) || 0;
                    }

                    if (key === 'connection' && val.toLowerCase() === 'close') {
                        keepAlive = false;
                    }
                }

                const totalLength = headerEnd + 4 + contentLength;

                if (buf.length < totalLength) break;

                if (method === 'GET') {
                    const res200 = Buffer.from(
                        `HTTP/1.1 200 OK\r\nContent-Length: ${Buffer.byteLength(message)}\r\nConnection: keep-alive\r\n\r\n${message}`
                    );
                    socket.write(res200);
                }

                else {
                    socket.write(res404);
                }

                off = totalLength;

                if (!keepAlive) {
                    socket.end();
                    return;
                }
            }

            socket.uncork();

            buf = off > 0 ? buf.slice(off) : buf;

            if (buf.length > 1024 * 1024) {
                socket.destroy();
            }
        });
    });

    server.listen(port, () => {
        console.log(`Server '${name}' running at http://localhost:${port}`);
    });

    return server;
};


// ServerNet({
//     name: 'Net',
//     port: 5000,
//     message: 'Hello from Net Server!'
// })

module.exports = { ServerNet }