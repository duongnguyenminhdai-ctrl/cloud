#!/usr/bin/env bash

# ==============================================================================
# RUN ALL UNIT TESTS FOR 5 MICROSERVICES (BASH SCRIPT)
# ==============================================================================

set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
node "$DIR/run-all-tests.js"

