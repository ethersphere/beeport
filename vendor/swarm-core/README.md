# Vendored build of https://github.com/ethersphere/swarm-core (0.0.1)

Not published to npm yet. Rebuilt from upstream when EC/splitter APIs change:

```sh
git clone --depth 1 https://github.com/ethersphere/swarm-core.git /tmp/swarm-core
cd /tmp/swarm-core && pnpm install && pnpm build
rm -rf "$REPO/vendor/swarm-core"
mkdir -p "$REPO/vendor/swarm-core"
cp package.json "$REPO/vendor/swarm-core/"
cp -R dist "$REPO/vendor/swarm-core/"
# strip private/devDeps from package.json, set version *-vendored
```
