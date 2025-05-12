const url = 'https://li.quest/v1/quote/contractCalls';
const options = {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    fromChain: 100,
    fromToken: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
    fromAddress: '0xB1620c0547744DeDD30F40a863c09D1964532F8C',
    toChain: 100,
    toToken: '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da',
    toAmount: '86651287319347200',
    slippage: 0.05,
    contractCalls: [
      {
        fromAmount: '86651287319347200',
        fromTokenAddress: '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da',
        toContractAddress: '0x1a3dc4cef861a7d3dcdc0d7c5adebf76c2197f20',
        toContractCallData:
          '0x2ff190d6000000000000000000000000b1620c0547744dedd30f40a863c09d1964532f8c000000000000000000000000b81784e65c84ca25b595ff4f0badb502673e343b00000000000000000000000000000000000000000000000000000004cf638c00000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000109f47cf7d69d07a631b7beb498d79868558cb4c667535ba78d5b8d2eb5ee688d30000000000000000000000000000000000000000000000000000000000000000',
        toContractGasLimit: '2000000',
      },
    ],
    integrator: 'Swarm',
  }),
};

fetch(url, options)
  .then(res => res.json())
  .then(json => console.log(json))
  .catch(err => console.error(err));
