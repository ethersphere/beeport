// We will probably just use one Gnosis Target Token and at best need a conterpart on other chains

export const tokenAddresses = {
  1: {
    // Ethereum
    name: "Ethereum",

    USDT: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
    },
    DAI: {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      decimals: 18,
    },
    WBTC: {
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      decimals: 8,
    },
    PEPE: {
      address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
      decimals: 18,
    },
    SPX6900: {
      address: "0x44e58B36D69a62d46cdf2a76Da66DAf0f19C645e",
      decimals: 18,
    }, // Assuming 18 decimals, please verify
    USDe: {
      address: "0x2261a09c2caa95e2d40ab284fc0b214e15ada319",
      decimals: 18,
    }, // Assuming 18 decimals, please verify
  },
  42161: {
    // Arbitrum
    name: "Arbitrum",
    ETH: {
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
    },
    WETH: {
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      decimals: 18,
    },
    USDC: {
      address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
      decimals: 6,
    },
    USDT: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
    },
    DAI: {
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      decimals: 18,
    },
    WBTC: {
      address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      decimals: 8,
    },
    ARB: {
      address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
      decimals: 18,
    },
    USDe: {
      address: "0xd7d25e9a152fb0a56342069d8c431b87e7f2f44e",
      decimals: 18,
    }, // Assuming 18 decimals, please verify
  },
  10: {
    // Optimism
    name: "Optimism",
    ETH: {
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
    },
    WETH: {
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
    },
    USDCe: {
      address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      decimals: 6,
    },
    USDC: {
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      decimals: 6,
    },
    USDT: {
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      decimals: 6,
    },
    DAI: {
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      decimals: 18,
    },
    WBTC: {
      address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
      decimals: 8,
    },
    OP: { address: "0x4200000000000000000000000000000000000042", decimals: 18 },
    USDe: {
      address: "0x89aA4364879c4D545B83050fECFB417f2340C545",
      decimals: 18,
    }, // Assuming 18 decimals, please verify
  },
  8453: {
    // Base
    name: "Base",
    ETH: {
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
    },
    WETH: {
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
    },
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
    USDT: {
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      decimals: 6,
    },
    DAI: {
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      decimals: 18,
    },
    WBTC: {
      address: "0x77852193BD608a518489a8728ab65123CD882993",
      decimals: 8,
    },
    DEGEN: {
      address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
      decimals: 18,
    }, // Assuming 18 decimals, please verify
    USDe: {
      address: "0x4C80E24119CFB836cdF0a6b53dc23F04F7e652CA",
      decimals: 18,
    }, // Assuming 18 decimals, please verify
  },
  100: {
    // Gnosis (formerly xDai)
    name: "Gnosis",
    xDAI: {
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
    },
    WETH: {
      address: "0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1",
      decimals: 18,
    },
    USDC: {
      address: "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83",
      decimals: 6,
    },
    USDT: {
      address: "0x4ECaBa5870353805a9F068101A40E0f32ed605C6",
      decimals: 6,
    },
    wxDAI: {
      address: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d",
      decimals: 18,
    },
    WBTC: {
      address: "0x8e5bBbb09Ed1ebdE8674Cda39A0c169401db4252",
      decimals: 8,
    },
    CELO: {
      address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
      decimals: 18,
    },
    xBZZ: {
      address: "0xdbf3ea6f5bee45c02255b2c26a16f300502f68da",
      decimals: 16,
    },
    GNO: {
      address: "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb",
      decimals: 18,
    },
  },
};
