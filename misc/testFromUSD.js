const fetch = require('node-fetch');

const url = 'https://li.quest/v1/quote?' + new URLSearchParams({
    fromChain: '100',
    toChain: '100',
    fromToken: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
    toToken: '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da',
    fromAddress: '0xB1620c0547744DeDD30F40a863c09D1964532F8C',
    toAddress: '0xB1620c0547744DeDD30F40a863c09D1964532F8C',
    fromAmount: '200000000',
    slippage: '0.05',
    allowExchanges: 'sushiswap',
    integrator: 'Swarm'
});

const options = {
    method: 'GET',
    headers: {
        accept: 'application/json'
    }
};

fetch(url, options)
    .then(res => res.json())
    .then(json => console.log(json))
    .catch(err => console.error('Fetch error:', err));
