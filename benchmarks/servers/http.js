const http = require('http')

const ServerHttp = ({ name, port, message }) => {
  const server = http.createServer({
    noDelay: true
  },(req, res) => {
    if (req.url === '/' && req.method === 'GET') {
      return res.end(message)
    }

    res.statusCode = 404
    return res.end('Not Found')
  })

  server.listen(port, () =>
    console.log(`Server '${name}' running at : http://localhost:${port}`)
  )

  return server
}

module.exports = { ServerHttp }