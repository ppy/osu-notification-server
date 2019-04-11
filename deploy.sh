#!/bin/sh

set -u
set -e

# install dependencies and perform build
command -v yarn || npm install -g yarn
yarn
yarn build

# perform deployment
outdir="/deploy/notify-$(date "+%Y%m%dT%H%M%S")"
mkdir -p "$outdir"
cp -pr ./ "$outdir"

ln -snf "$outdir" "/deploy/notify-current"
