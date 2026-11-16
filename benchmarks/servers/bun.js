const ServerBun = ({ name, port, message }) => {
  const server = Bun.serve({
    port,

    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/' && req.method === 'GET') {
        return new Response(message);
      }

      return new Response('Not Found', {
        status: 404,
      });
    },
  });

  console.log(`Server '${name}' running at : http://localhost:${port}`);

  return server;
};

module.exports = { ServerBun };