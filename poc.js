// required constants

const ethers = require('ethers');
const axios = require('axios');

const API_URL = 'https://li.quest/v1';

const fromChain = 'DAI';
const fromToken = 'USDC';
const toChain = 'POL';
const toToken = 'USDC';
const fromAmount = '1000000';
const fromAddress = YOUR_WALLET_ADDRESS;


// made sure that the user is allowed to send the requested amount from his wallet

const { Contract } = require('ethers');

const ERC20_ABI = [
    {
        "name": "approve",
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "name": "allowance",
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// Get the current allowance and update it if needed
const checkAndSetAllowance = async (wallet, tokenAddress, approvalAddress, amount) => {
    // Transactions with the native token don't need approval
    if (tokenAddress === ethers.constants.AddressZero) {
        return
    }

    const erc20 = new Contract(tokenAddress, ERC20_ABI, wallet);
    const allowance = await erc20.allowance(await wallet.getAddress(), approvalAddress);

    if (allowance.lt(amount)) {
        const approveTx = await erc20.approve(approvalAddress, amount);
        await approveTx.wait();
    }
}

await checkAndSetAllowance(wallet, quote.action.fromToken.address, quote.estimate.approvalAddress, fromAmount);

// Step 1: Requesting a Quote

// request for a transfer from 1 USDC on Gnosis to USDC on Polygon
const getQuote = async (fromChain, toChain, fromToken, toToken, fromAmount, fromAddress) => {
    const result = await axios.get('https://li.quest/v1/quote', {
        params: {
            fromChain,
            toChain,
            fromToken,
            toToken,
            fromAmount,
            fromAddress,
        }
    });
    return result.data;
}

// Set up your wallet
const provider = new ethers.providers.JsonRpcProvider('https://rpc.xdaichain.com/', 100);
const wallet = ethers.Wallet.fromMnemonic(YOUR_PERSONAL_MNEMONIC).connect(
    provider
);

// the quote response contains a transactionRequest object
// which can be directly passed on to your wallet/signer
const quote = await getQuote(fromChain, toChain, fromToken, toToken, fromAmount, fromAddress);

// Step 2: Sending the Transaction

// send transaction using the transactionRequest
// inside the previously retrieved quote

const run = async () => {
    const quote = await getQuote(fromChain, toChain, fromToken, toToken, fromAmount, fromAddress);
    const tx = await wallet.sendTransaction(quote.transactionRequest);

    await tx.wait();

    // Only needed for cross chain transfers
    if (fromChain !== toChain) {
        let result;
        do {
            result = await getStatus(quote.tool, fromChain, toChain, tx.hash);
        } while (result.status !== 'DONE' && result.status !== 'FAILED')
    }
}

run().then(() => {
    console.log('DONE!')
});

// for cross-chain transfers, the processing takes a bit longer
// to handle this the API provides an endpoint to check the transfer status

const getStatus = async (bridge, fromChain, toChain, txHash) => {
    const result = await axios.get('https://li.quest/v1/status', {
        params: {
            bridge,
            fromChain,
            toChain,
            txHash,
        }
    });
    return result.data;
}

result = await getStatus(quote.tool, fromChain, toChain, tx.hash);

