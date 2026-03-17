const https = require('https');
const http = require('http');
const fs = require('fs');

const SSL_PORT = 3001;
const TARGET = 'http://127.0.0.1:3000';

const options = {
  key: fs.readFileSync('./cert.key'),
  cert: fs.readFileSync('./cert.crt'),
};

const proxy = https.createServer(options, (req, res) => {
  const proxyReq = http.request(
    TARGET + req.url,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: req.headers.host,
        'x-forwarded-proto': 'https',
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway - Is Next.js running on port 3000?');
  });

  req.pipe(proxyReq);
});

proxy.listen(SSL_PORT, '0.0.0.0', () => {
  console.log(`\n🔒 HTTPS Proxy running at:`);
  console.log(`   https://localhost:${SSL_PORT}`);
  console.log(`   https://192.168.2.101:${SSL_PORT}`);
  console.log(`\n   → Proxying to ${TARGET}\n`);
  console.log(`⚠️  Make sure "npm run dev" is running in another terminal!\n`);
});
