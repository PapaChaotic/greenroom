#!/usr/bin/env bash
# Launch Xbox Party Chat. Node is installed per-user in ~/.local/opt/node.
export PATH="$HOME/.local/opt/node/bin:$PATH"
cd "$(dirname "$0")"
exec npm start
