const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const {
    createPublicClient,
    http,
} = require("viem");
const { gnosis } = require("viem/chains");
const cors = require('cors');

const BATCH_REGISTRY_ABI = [
    {
        name: "getBatchPayer",
        type: "function",
        stateMutability: "view",
        inputs: [{ type: "bytes32", name: "batchId" }],
        outputs: [{ type: "address" }],
    },
];

const app = express();

app.options("*", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    res.sendStatus(200);
});

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    next();
});

app.use(cors({
    origin: ['https://swarming.site']
}));

const gnosisPublicClient = createPublicClient({
    chain: gnosis,
    transport: http(),
});

const verifySignature = async (req, res, next) => {
    console.log("Processing request at path:", req.path);

    if (req.method === "POST") {
        console.log("Processing upload request");

        const signedMessage = req.headers["x-upload-signed-message"];
        const uploaderAddress = req.headers["x-uploader-address"];
        const fileName = req.headers["x-file-name"];
        const batchId = req.headers["swarm-postage-batch-id"];
        const messageContent = req.headers["x-message-content"];
        const registryAddress = req.headers["registry-address"];


        console.log("Headers received:", {
            signedMessage: signedMessage ? "exists" : "missing",
            uploaderAddress,
            fileName,
            batchId,
            messageContent
        });

        if (!signedMessage || !uploaderAddress || !fileName || !batchId) {
            return res.status(401).json({
                error: "Missing required headers",
                missing: {
                    signedMessage: !signedMessage,
                    uploaderAddress: !uploaderAddress,
                    fileName: !fileName,
                    batchId: !batchId
                },
            });
        }

        try {
            // Recreate the same message string that was signed
            // If we have messageContent from header, use that; otherwise reconstruct it
            const messageToVerify = messageContent || `${fileName}:${batchId}`;
            console.log("Message to verify:", messageToVerify);

            // Simple verification - just verify the string was signed
            const recoveredAddressValid = await gnosisPublicClient.verifyMessage({
                address: uploaderAddress,
                message: messageToVerify,
                signature: signedMessage,
            });

            console.log("Verification result:", recoveredAddressValid);

            if (!recoveredAddressValid) {
                return res.status(401).json({
                    error: "Invalid signed message",
                    recovered: false,
                    provided: uploaderAddress,
                });
            }

            // Continue with batch ownership verification...
            if (registryAddress) {
                try {
                    console.log(`Verifying batch ownership for batch ${batchId} with registry ${registryAddress}`);

                    const formattedBatchId = batchId.startsWith("0x") ? batchId : `0x${batchId}`;

                    const batchPayer = await gnosisPublicClient.readContract({
                        address: registryAddress,
                        abi: BATCH_REGISTRY_ABI,
                        functionName: "getBatchPayer",
                        args: [formattedBatchId],
                    });

                    console.log(`Batch payer: ${batchPayer}, Uploader: ${uploaderAddress}`);

                    if (batchPayer.toLowerCase() !== uploaderAddress.toLowerCase()) {
                        return res.status(403).json({
                            error: "Not authorized to use this batch",
                            batchPayer: batchPayer,
                            uploader: uploaderAddress,
                        });
                    }
                } catch (batchError) {
                    console.error("Error verifying batch ownership:", batchError);
                    return res.status(500).json({
                        error: "Failed to verify batch ownership",
                        details: batchError.message,
                    });
                }
            }

            console.log("Verification successful");
            next();
        } catch (error) {
            console.error("Verification Error:", error);
            return res.status(401).json({
                error: "Verification failed",
                details: error.message,
            });
        }
    } else {
        next();
    }
};

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    next();
});

const proxy = createProxyMiddleware({
    target: "http://localhost:1633",
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
            'Content-Type': 'text/plain'
        });
        res.end('Proxy error: ' + err.message);
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log('Proxy request:', {
            path: req.path,
            method: req.method,
            contentLength: req.headers['content-length']
        });
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log('Proxy response:', {
            path: req.path,
            method: req.method,
            statusCode: proxyRes.statusCode
        });
    }
});

app.use("/", verifySignature, proxy);

const server = app.listen(3333, () => {
    console.log("Proxy server running on port 3333");
});

server.timeout = 3600000; // 1 hour
server.keepAliveTimeout = 3600000;
server.headersTimeout = 3600000;

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});