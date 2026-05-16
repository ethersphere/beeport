# Changelog

All notable changes to Beeport are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.10] - 2026-05-03

### Changed

- **SushiSwapStampsRouter** redeployed at
  [`0xf244cC25EAD03a99de8B407A3237aaf54D1b779C`](https://gnosisscan.io/address/0xf244cC25EAD03a99de8B407A3237aaf54D1b779C)
  with security and gas-cost improvements (#132).

### Fixed

- **Ledger uploads**: removed the artificial `signMessage` timeout that caused
  hardware-wallet signing to abort prematurely on slower devices (#133).

## [1.1.9] - 2026-04-08

### Added

- **Cross-chain stamp purchase** via Relay → USDC → SushiRouter → BZZ pipeline
  for buying stamps from any supported chain (#131).
- **SushiSwap V3** integration for Gnosis-native token swaps, replacing the
  prior Relay-only path on Gnosis (#130).
- Sushi router address added to shared constants.

### Fixed

- Use Relay's native Circle USDC address on Gnosis for cross-chain bridging.
- Gate "spend token" options on real Sushi routes and pool liquidity to avoid
  offering routes that cannot execute.
- Read the actual pool fee from the contract instead of hard-coding it for USDC.
- Resolve `KNOWN_BZZ_POOLS` crash and broken multi-hop routing.
- Resolve `ERR_UNKNOWN_FILE_EXTENSION` for Hardhat scripts on Node 22.
- Tighten swap timer buffers.

[1.1.10]: https://github.com/ethersphere/beeport/compare/1.1.9...1.1.10
[1.1.9]: https://github.com/ethersphere/beeport/compare/1.1.8...1.1.9
