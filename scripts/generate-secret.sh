#!/bin/sh
# Generate a secure AUTH_SECRET for NextAuth.js
# Usage: ./scripts/generate-secret.sh

SECRET=$(openssl rand -base64 32)
echo ""
echo "Generated AUTH_SECRET:"
echo ""
echo "  $SECRET"
echo ""
echo "Add this to your .env file or hosting environment variables:"
echo "  AUTH_SECRET=$SECRET"
echo ""
