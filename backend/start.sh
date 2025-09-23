#!/bin/sh
set -e

echo "Ensuring data directory exists..."
mkdir -p data

echo "Initializing database..."
yarn migrate
yarn push

echo "Starting application..."
yarn start 