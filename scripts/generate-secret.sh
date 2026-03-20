#!/bin/sh
SECRET=$(openssl rand -base64 32)
echo "Generated AUTH_SECRET:"
echo ""
echo "  AUTH_SECRET=$SECRET"
echo ""
echo "Add this to your .env file or environment variables."
