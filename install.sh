#!/bin/bash

# share-site installer
# Usage: curl -fsSL https://raw.githubusercontent.com/bob-rietveld/share-site/main/install.sh | bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO="bob-rietveld/share-site"
SCRIPT_NAME="share-site"

echo -e "${BLUE}Installing share-site...${NC}"
echo ""

# Determine install location
if [[ -w /usr/local/bin ]]; then
  INSTALL_DIR="/usr/local/bin"
elif [[ -d "$HOME/.local/bin" ]]; then
  INSTALL_DIR="$HOME/.local/bin"
else
  mkdir -p "$HOME/.local/bin"
  INSTALL_DIR="$HOME/.local/bin"
fi

# Download the script
DOWNLOAD_URL="https://raw.githubusercontent.com/$REPO/main/$SCRIPT_NAME"

if command -v curl &> /dev/null; then
  curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_DIR/$SCRIPT_NAME"
elif command -v wget &> /dev/null; then
  wget -q "$DOWNLOAD_URL" -O "$INSTALL_DIR/$SCRIPT_NAME"
else
  echo -e "${RED}Error: curl or wget required${NC}"
  exit 1
fi

# Make executable
chmod +x "$INSTALL_DIR/$SCRIPT_NAME"

# Check if install dir is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo -e "${GREEN}✓ Installed to $INSTALL_DIR/$SCRIPT_NAME${NC}"
  echo ""
  echo -e "${BLUE}Add to PATH by running:${NC}"

  if [[ -f "$HOME/.zshrc" ]]; then
    echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.zshrc && source ~/.zshrc"
  else
    echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
  fi
  echo ""
else
  echo -e "${GREEN}✓ Installed successfully!${NC}"
fi

echo -e "${GREEN}Run 'share-site --help' to get started${NC}"
