const net = require('net');

const ServerNet = ({ name, port, message }) => {

    const slab = Buffer.allocUnsafe(64 * 1024);

    const server = net.createServer((socket) => {
        socket.setNoDelay(true);
        socket.on('error', () => socket.destroy());

        socket.on('data', (chunk) => {
            let off = 0;
            while (off < chunk.length) {
                const end = chunk.indexOf('\r\n\r\n', off);
                if (end === -1) break;

                if (chunk[off] === 0x47 && chunk[off + 4] === 0x2f) {

                    const body = message; 
                    const bodyLen = Buffer.byteLength(body);

                    let pos = slab.write(`HTTP/1.1 200 OK\r\nContent-Length: ${bodyLen}\r\n\r\n`, 0);
                    pos += slab.write(body, pos);

                    socket.write(slab.subarray(0, pos));

                    off = end + 4;
                    continue; 
                }

                const pos = slab.write('HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: keep-alive\r\n\r\nNot Found', 0);
                socket.write(slab.subarray(0, pos));
                
                off = end + 4;
            }
        });
    });

    server.listen(port, () =>
        console.log(`Server '${name}' running at : http://localhost:${port}`)
    )

    return server;
};

module.exports = { ServerNet }