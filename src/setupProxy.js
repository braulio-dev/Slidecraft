const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:11434',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      pathRewrite: {
        '^/api': '/api', // Ollama uses /api prefix
      },
      onError: function (err, req, res) {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Proxy error - is Ollama running on port 11434?' });
      },
      onProxyReq: function (proxyReq, req, res) {
        console.log('Proxying request:', req.method, req.url, '→', proxyReq.path);
      }
    })
  );
};