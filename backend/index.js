require('dotenv').config();

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createPublicClient, http } = require('viem');
const { gnosis } = require('viem/chains');
const crypto = require('crypto');

// Add this near the top with other environment variables
const PORT = process.env.PORT || 3333;
const PROXY_TARGET = process.env.PROXY_TARGET || 'http://localhost:1633';
const REGISTRY_ADDRESS =
  process.env.REGISTRY_ADDRESS || '0x5EBfBeFB1E88391eFb022d5d33302f50a46bF4f3';

// Session management for multi-file uploads
const uploadSessions = new Map();
const SESSION_DURATION = 15 * 60 * 1000; // 15 minutes
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of uploadSessions.entries()) {
    if (now - session.createdAt > SESSION_DURATION) {
      uploadSessions.delete(sessionId);
    }
  }
}, SESSION_CLEANUP_INTERVAL);

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

// Generate a secure session token
const generateSessionToken = (uploaderAddress, batchId) => {
  const data = `${uploaderAddress}:${batchId}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Check if there's a valid session for this upload
const checkExistingSession = (uploaderAddress, batchId, sessionToken) => {
  if (!sessionToken) return null;

  const session = uploadSessions.get(sessionToken);
  if (!session) return null;

  const now = Date.now();
  if (now - session.createdAt > SESSION_DURATION) {
    uploadSessions.delete(sessionToken);
    return null;
  }

  if (
    session.uploaderAddress.toLowerCase() !== uploaderAddress.toLowerCase() ||
    session.batchId !== batchId
  ) {
    return null;
  }

  return session;
};

const verifySignature = async (req, res, next) => {
  console.log('Processing request at path:', req.path);

  if (req.method === 'POST') {
    console.log('Processing upload request');

    const signedMessage = req.headers['x-upload-signed-message'];
    const uploaderAddress = req.headers['x-uploader-address'];
    const fileName = req.headers['x-file-name'];
    const batchId = req.headers['swarm-postage-batch-id'];
    const messageContent = req.headers['x-message-content'];
    const sessionToken = req.headers['x-upload-session-token']; // New header for session token
    const isMultiFileUpload = req.headers['x-multi-file-upload'] === 'true'; // New header to indicate multi-file upload

    console.log('Headers received:', {
      signedMessage: signedMessage ? 'exists' : 'missing',
      uploaderAddress,
      fileName,
      batchId,
      messageContent,
      sessionToken: sessionToken ? 'exists' : 'missing',
      isMultiFileUpload,
    });

    // Check for existing session first (for multi-file uploads)
    if (sessionToken && uploaderAddress && batchId) {
      const existingSession = checkExistingSession(uploaderAddress, batchId, sessionToken);
      if (existingSession) {
        console.log(
          `🎫 Valid session found for ${uploaderAddress}, file #${existingSession.fileCount + 1}, skipping detailed verification`
        );
        // Update session last used time
        existingSession.lastUsed = Date.now();
        existingSession.fileCount += 1;

        // Add session info to response headers for client
        res.setHeader('x-session-token', sessionToken);
        res.setHeader('x-session-valid', 'true');
        return next();
      } else {
        console.log(
          `❌ Invalid or expired session token provided: ${sessionToken.substring(0, 8)}...`
        );
      }
    }

    // Full verification required (first file or no valid session)
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

      // Create session token for multi-file uploads
      if (isMultiFileUpload) {
        const newSessionToken = generateSessionToken(uploaderAddress, batchId);
        uploadSessions.set(newSessionToken, {
          uploaderAddress,
          batchId,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          fileCount: 1,
        });

        console.log(
          `✅ Created new session token for multi-file upload: ${newSessionToken.substring(0, 8)}... for ${uploaderAddress}`
        );

        // Add session token to response headers
        res.setHeader('x-session-token', newSessionToken);
        res.setHeader('x-session-created', 'true');
        console.log('✅ Session headers set in response');
      }

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
