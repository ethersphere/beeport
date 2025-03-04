const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const {
    keccak256,
    encodeAbiParameters,
    parseAbiParameters,
    createPublicClient,
    http,
} = require("viem");
const { gnosis } = require("viem/chains");

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

const gnosisPublicClient = createPublicClient({
    chain: gnosis,
    transport: http(),
});

// Modify verifySignature to only check POST requests to /bzz
const verifySignature = async (req, res, next) => {
    if (req.path === "/bzz" && req.method === "POST") {
        const signedMessage = req.headers["x-upload-signed-message"];
        const uploaderAddress = req.headers["x-uploader-address"];
        const fileName = req.headers["x-file-name"];
        const batchId = req.headers["swarm-postage-batch-id"];
        const registryAddress = req.headers["registry-address"];

        if (!signedMessage || !uploaderAddress || !fileName || !batchId) {
            return res.status(401).json({
                error: "Missing required headers",
                missing: { signedMessage, uploaderAddress, fileName, batchId },
            });
        }

        try {
            const messageHash = keccak256(
                encodeAbiParameters(parseAbiParameters(["string", "bytes32"]), [
                    fileName,
                    `0x${batchId}`,
                ])
            );

            const recoveredAddressValid = await gnosisPublicClient.verifyMessage({
                address: uploaderAddress,
                message: { raw: messageHash },
                signedMessage,
            });

            if (!recoveredAddressValid) {
                return res.status(401).json({
                    error: "Invalid signed message",
                    recovered: recoveredAddressValid,
                    provided: uploaderAddress,
                });
            }

            // Verify batch ownership if registry address is provided
            if (registryAddress) {
                try {
                    console.log(`Verifying batch ownership for batch ${batchId} with registry ${registryAddress}`);

                    const batchPayer = await gnosisPublicClient.readContract({
                        address: registryAddress,
                        abi: BATCH_REGISTRY_ABI,
                        functionName: "getBatchPayer",
                        args: [`0x${batchId}`],
                    });

                    console.log(`Batch payer: ${batchPayer}, Uploader: ${uploaderAddress}`);

                    // Case-insensitive comparison of addresses
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

            next();
        } catch (error) {
            console.error("\x1b[31m%s\x1b[0m", "Verification Error:", error);
            return res.status(401).json({
                error: "Verification failed",
                details: error.message,
                stack: error.stack,
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