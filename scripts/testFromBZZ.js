const fetch = require('node-fetch');

const url =
  'https://li.quest/v1/quote?' +
  new URLSearchParams({
    fromChain: '100',
    toChain: '100',
    fromToken: '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da',
    toToken: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
    fromAddress: '0xB1620c0547744DeDD30F40a863c09D1964532F8C',
    toAddress: '0xB1620c0547744DeDD30F40a863c09D1964532F8C',
    fromAmount: '5586651287319347200',
    slippage: '0.05',
    integrator: 'Swarm',
  });

const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
  },
};

fetch(url, options)
  .then(res => res.json())
  .then(json => console.log(json))
  .catch(err => console.error('Fetch error:', err));
