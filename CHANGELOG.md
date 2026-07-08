# Changelog

All notable changes to Beeport are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.11] - 2026-07-08

### Added

- **Erasure coding** option for single-file and multi-file uploads, with
  dropdown control and tooltip (#53, #144).
- **Bee gateway health check** before upload; stamp API is gated on Bee health
  (#134).
- **Multi-file upload success UI** with direct links to uploaded content (#146).
- **NFT uploads**: nested ZIP layout and clearer upload UX (#135).
- Storage labels and improved refresh control with tooltip styling (#141).

### Changed

- **Stamp purchases** now route exclusively through Relay; manual BZZ approval
  and unused Gnosis token constants removed (#142).
- Upload history opens content from the filename; rename uses a pencil icon
  (#138).
- Forward `swarm-redundancy-level` header to the upstream Bee node.

### Fixed

- Stale `isWebpageUpload` flag on non-archive uploads (#145).
- Proxy serving dead sockets after upstream Bee restart (#140).

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

[1.1.11]: https://github.com/ethersphere/beeport/compare/1.1.10...1.1.11
[1.1.10]: https://github.com/ethersphere/beeport/compare/1.1.9...1.1.10
[1.1.9]: https://github.com/ethersphere/beeport/compare/1.1.8...1.1.9
