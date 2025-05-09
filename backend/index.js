require('dotenv').config();

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createPublicClient, http } = require('viem');
const { gnosis } = require('viem/chains');

// Add this near the top with other environment variables
const PORT = process.env.PORT || 3333;
const PROXY_TARGET = process.env.PROXY_TARGET || 'http://localhost:1633';
const REGISTRY_ADDRESS =
  process.env.REGISTRY_ADDRESS || '0x27429910641560EF5308CF76027e05a674Ab0B70';

const BATCH_REGISTRY_ABI = [
  {
    name: 'getBatchPayer',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32', name: 'batchId' }],
    outputs: [{ type: 'address' }],
  },
];

const app = express();

const gnosisPublicClient = createPublicClient({
  chain: gnosis,
  transport: http(),
});

const verifySignature = async (req, res, next) => {
  console.log('Processing request at path:', req.path);

  if (req.method === 'POST') {
    console.log('Processing upload request');

    const signedMessage = req.headers['x-upload-signed-message'];
    const uploaderAddress = req.headers['x-uploader-address'];
    const fileName = req.headers['x-file-name'];
    const batchId = req.headers['swarm-postage-batch-id'];
    const messageContent = req.headers['x-message-content'];

    console.log('Headers received:', {
      signedMessage: signedMessage ? 'exists' : 'missing',
      uploaderAddress,
      fileName,
      batchId,
      messageContent,
    });

    if (!signedMessage || !uploaderAddress || !fileName || !batchId) {
      return res.status(401).json({
        error: 'Missing required headers',
        missing: {
          signedMessage: !signedMessage,
          uploaderAddress: !uploaderAddress,
          fileName: !fileName,
          batchId: !batchId,
        },
      });
    }

    try {
      // Recreate the same message string that was signed
      // If we have messageContent from header, use that; otherwise reconstruct it
      const messageToVerify = messageContent || `${fileName}:${batchId}`;
      console.log('Message to verify:', messageToVerify);

      // Simple verification - just verify the string was signed
      const recoveredAddressValid = await gnosisPublicClient.verifyMessage({
        address: uploaderAddress,
        message: messageToVerify,
        signature: signedMessage,
      });

      console.log('Verification result:', recoveredAddressValid);

      if (!recoveredAddressValid) {
        return res.status(401).json({
          error: 'Invalid signed message',
          recovered: false,
          provided: uploaderAddress,
        });
      }

      // Continue with batch ownership verification...
      if (REGISTRY_ADDRESS) {
        try {
          console.log(
            `Verifying batch ownership for batch ${batchId} with registry ${REGISTRY_ADDRESS}`
          );

          const formattedBatchId = batchId.startsWith('0x') ? batchId : `0x${batchId}`;

          const batchPayer = await gnosisPublicClient.readContract({
            address: REGISTRY_ADDRESS,
            abi: BATCH_REGISTRY_ABI,
            functionName: 'getBatchPayer',
            args: [formattedBatchId],
          });

          console.log(`Batch payer: ${batchPayer}, Uploader: ${uploaderAddress}`);

          if (batchPayer.toLowerCase() !== uploaderAddress.toLowerCase()) {
            return res.status(403).json({
              error: 'Not authorized to use this batch',
              batchPayer: batchPayer,
              uploader: uploaderAddress,
            });
          }
        } catch (batchError) {
          console.error('Error verifying batch ownership:', batchError);
          return res.status(500).json({
            error: 'Failed to verify batch ownership',
            details: batchError.message,
          });
        }
      }

      console.log('Verification successful');
      next();
    } catch (error) {
      console.error('Verification Error:', error);
      return res.status(401).json({
        error: 'Verification failed',
        details: error.message,
      });
    }
  } else {
    next();
  }
};

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

const proxy = createProxyMiddleware({
  target: PROXY_TARGET,
  changeOrigin: true,
  pathRewrite: null,
  secure: false,
  ws: true,
  proxyTimeout: 3600000, // 1 hour
  timeout: 3600000, // 1 hour
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.writeHead(500, {
      'Content-Type': 'text/plain',
    });
    res.end('Proxy error: ' + err.message);
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('Proxy request:', {
      path: req.path,
      method: req.method,
      contentLength: req.headers['content-length'],
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Proxy response:', {
      path: req.path,
      method: req.method,
      statusCode: proxyRes.statusCode,
    });
  },
});

app.use('/', verifySignature, proxy);

const server = app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});

server.timeout = 3600000; // 1 hour
server.keepAliveTimeout = 3600000;
server.headersTimeout = 3600000;

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err);
});
