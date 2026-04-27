#!/bin/bash
set -e

echo "╔═══════════════════════════════════════╗"
echo "║   Building Debate System             ║"
echo "╚═══════════════════════════════════════╝"

npm install

echo ""
echo "Running TypeScript build..."
npx tsc

echo ""
echo "Running tests..."
npm test

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   All checks passed!               ║"
echo "╚═══════════════════════════════════════╝"