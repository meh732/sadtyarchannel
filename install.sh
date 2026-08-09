#!/bin/bash

# ==========================================
# Telegram V2Ray Extractor Bot Setup Script
# Sanaei-style Interactive Linux Installer
# English Language Edition
# ==========================================

# Color Codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0;0m' # No Color

# Font styles
BOLD='\033[1m'

# Paths
INSTALL_DIR="/opt/v2ray-extractor-bot"
SERVICE_NAME="v2ray-extractor-bot"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# Check root privileges
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}${BOLD}Error: Please run this script with root privileges (sudo bash install.sh).${NC}"
    exit 1
fi

show_banner() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "=================================================================="
    echo "  ██╗   ██╗██████╗ ██████╗  █████╗ ██╗   ██╗    ██████╗  ██████╗ ████████╗"
    echo "  ██║   ██║╚════██╗██╔══██╗██╔══██╗╚██╗ ██╔╝    ██╔══██╗██╔═══██╗╚══██╔══╝"
    echo "  ██║   ██║ █████╔╝██████╔╝███████║ ╚████╔╝     ██████╔╝██║   ██║   ██║   "
    echo "  ╚██╗ ██╔╝██╔═══╝ ██╔══██╗██╔══██║  ╚██╔╝      ██╔══██╗██║   ██║   ██║   "
    echo "   ╚████╔╝ ███████╗██║  ██║██║  ██║   ██║       ██████╔╝╚██████╔╝   ██║   "
    echo "    ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝       ╚═════╝  ╚═════╝    ╚═╝   "
    echo "=================================================================="
    echo -e "       V2Ray Config Extractor & Telegram Auto-Posting Bot         "
    echo -e "               Sanaei-Style Premium Installer v1.0.0               "
    echo -e "==================================================================${NC}"
    echo ""
}

# Check and Install System Dependencies
install_system_deps() {
    echo -e "${BLUE}[1/4] Checking and installing system dependencies...${NC}"
    
    # Detect Package Manager
    if [ -f /etc/debian_version ]; then
        PM="apt-get"
        echo -e "${GREEN}Detected Debian/Ubuntu system.${NC}"
    elif [ -f /etc/redhat-release ]; then
        PM="yum"
        echo -e "${GREEN}Detected CentOS/RHEL/Fedora system.${NC}"
    else
        echo -e "${YELLOW}Unknown OS distribution. Attempting to use apt-get...${NC}"
        PM="apt-get"
    fi

    # Update repositories
    if [ "$PM" = "apt-get" ]; then
        apt-get update -y >/dev/null 2>&1
        apt-get install -y curl git build-essential >/dev/null 2>&1
    else
        yum update -y >/dev/null 2>&1
        yum groupinstall -y "Development Tools" >/dev/null 2>&1
        yum install -y curl git >/dev/null 2>&1
    fi

    # Check for Node.js & NPM
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${YELLOW}Node.js is not installed. Installing Node.js LTS...${NC}"
        if [ "$PM" = "apt-get" ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            apt-get install -y nodejs >/dev/null 2>&1
        else
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            yum install -y nodejs >/dev/null 2>&1
        fi
    fi

    echo -e "Node.js Version: ${GREEN}$(node -v)${NC}"
    echo -e "NPM Version:     ${GREEN}$(npm -v)${NC}"
    echo -e "${GREEN}System dependencies are up to date!${NC}"
    echo ""
}

# Prompt user for credentials
prompt_credentials() {
    echo -e "${BLUE}[2/4] Configuration Wizard${NC}"
    
    # Prompt for Admin Telegram ID
    while true; do
        read -p "Enter your Telegram Account Numerical User ID (Admin ID): " admin_id
        if [[ "$admin_id" =~ ^[0-9]+$ ]]; then
            break
        else
            echo -e "${RED}Invalid ID. Telegram User ID must contain only numbers.${NC}"
        fi
    done

    # Prompt for Telegram Bot Token
    while true; do
        read -p "Enter your Telegram Bot Token (from @BotFather): " bot_token
        if [[ "$bot_token" =~ ^[0-9]+:[a-zA-Z0-9_-]+$ ]]; then
            break
        else
            echo -e "${RED}Invalid Bot Token format. Example: 123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ${NC}"
        fi
    done
    echo ""
}

# Install or Reinstall Bot
install_bot() {
    show_banner
    echo -e "${YELLOW}${BOLD}Starting Installation Process...${NC}\n"
    
    # Install dependencies
    install_system_deps
    
    # Prompt credentials
    prompt_credentials

    # Stop existing service if any
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${YELLOW}Stopping existing $SERVICE_NAME service...${NC}"
        systemctl stop "$SERVICE_NAME"
    fi

    # Setup Directory
    echo -e "${BLUE}[3/4] Copying repository files...${NC}"
    mkdir -p "$INSTALL_DIR"
    
    # If the installer is run from the project root, copy current files. Otherwise, clone
    if [ -f "./package.json" ] && [ -f "./server.ts" ]; then
        echo -e "Copying project files from current workspace..."
        cp -r ./* "$INSTALL_DIR/" 2>/dev/null || true
        cp -r ./.* "$INSTALL_DIR/" 2>/dev/null || true
    else
        echo -e "Cloning latest source files to $INSTALL_DIR..."
        rm -rf "$INSTALL_DIR"
        git clone https://github.com/aistudio-build/v2ray-extractor-bot.git "$INSTALL_DIR"
    fi

    cd "$INSTALL_DIR" || exit 1

    # Create .env File
    echo -e "Writing configuration environment variables..."
    cat <<EOF > "$INSTALL_DIR/.env"
NODE_ENV=production
ADMIN_ID="${admin_id}"
BOT_TOKEN="${bot_token}"
EOF

    # Install packages and build
    echo -e "${BLUE}[4/4] Installing npm packages and compiling application...${NC}"
    npm install
    npm run build

    # Configure Systemd Daemon Service
    echo -e "Setting up systemd service daemon..."
    cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Telegram V2Ray Config Extractor & Auto-Poster Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/npm start
Restart=always
EnvironmentFile=${INSTALL_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and start service
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"

    echo ""
    echo -e "=================================================================="
    echo -e "${GREEN}${BOLD}🎉 Installation Completed Successfully!${NC}"
    echo -e "=================================================================="
    echo -e "Admin ID:      ${CYAN}${admin_id}${NC}"
    echo -e "Bot Service:   ${GREEN}Active & Auto-start Enabled${NC}"
    echo -e "Directory:     ${YELLOW}${INSTALL_DIR}${NC}"
    echo -e "Web Panel:     ${CYAN}http://localhost:3000${NC}"
    echo -e "=================================================================="
    echo -e "Send ${GREEN}/admin${NC} inside your Telegram Bot to manage features!"
    echo -e "=================================================================="
    read -p "Press [Enter] to return to the main menu."
}

# Update existing Bot installation
update_bot() {
    show_banner
    echo -e "${YELLOW}${BOLD}Checking for Bot Updates...${NC}\n"

    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "${RED}Error: Bot is not installed at $INSTALL_DIR.${NC}"
        echo -e "Please run Option [1] to perform a clean installation."
        read -p "Press [Enter] to return to the main menu."
        return
    fi

    cd "$INSTALL_DIR" || exit 1

    echo -e "${BLUE}Stopping bot daemon...${NC}"
    systemctl stop "$SERVICE_NAME"

    echo -e "${BLUE}Pulling and copying latest updates...${NC}"
    if [ -d ".git" ]; then
        git pull
    else
        echo -e "Local directory detected. Refreshing source directory files..."
        cp -r /workspace/* "$INSTALL_DIR/" 2>/dev/null || true
    fi

    echo -e "${BLUE}Re-installing packages and compiling...${NC}"
    npm install
    npm run build

    echo -e "${BLUE}Starting bot daemon...${NC}"
    systemctl start "$SERVICE_NAME"

    echo -e "${GREEN}${BOLD}🎉 Bot updated and restarted successfully!${NC}"
    read -p "Press [Enter] to return to the main menu."
}

# Uninstall Bot
uninstall_bot() {
    show_banner
    echo -e "${RED}${BOLD}🚨 Uninstallation Process${NC}"
    read -p "Are you absolutely sure you want to completely uninstall the Bot? (y/n): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Uninstallation cancelled.${NC}"
        read -p "Press [Enter] to return to the main menu."
        return
    fi

    echo -e "${BLUE}Stopping and disabling service daemon...${NC}"
    systemctl stop "$SERVICE_NAME" >/dev/null 2>&1
    systemctl disable "$SERVICE_NAME" >/dev/null 2>&1

    echo -e "${BLUE}Removing systemd service files...${NC}"
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload

    echo -e "${BLUE}Deleting installation directory $INSTALL_DIR...${NC}"
    rm -rf "$INSTALL_DIR"

    echo -e "${GREEN}${BOLD}🗑️ Bot completely uninstalled from your server.${NC}"
    read -p "Press [Enter] to return to the main menu."
}

# Modify Bot settings & credentials
configure_credentials() {
    show_banner
    echo -e "${YELLOW}${BOLD}Edit Bot Credentials & Administrator ID${NC}\n"

    if [ ! -f "$INSTALL_DIR/.env" ]; then
        echo -e "${RED}Error: Configuration file not found at $INSTALL_DIR/.env.${NC}"
        read -p "Press [Enter] to return to the main menu."
        return
    fi

    # Read current env
    current_admin=$(grep -oP 'ADMIN_ID="\K[^"]+' "$INSTALL_DIR/.env")
    current_token=$(grep -oP 'BOT_TOKEN="\K[^"]+' "$INSTALL_DIR/.env")

    echo -e "Current Admin ID:  ${CYAN}$current_admin${NC}"
    echo -e "Current Bot Token: ${CYAN}$current_token${NC}\n"

    # Prompt new values
    prompt_credentials

    # Write new env
    cat <<EOF > "$INSTALL_DIR/.env"
NODE_ENV=production
ADMIN_ID="${admin_id}"
BOT_TOKEN="${bot_token}"
EOF

    echo -e "${BLUE}Restarting bot service to apply changes...${NC}"
    systemctl restart "$SERVICE_NAME"

    echo -e "${GREEN}${BOLD}✅ Bot credentials successfully updated and service restarted!${NC}"
    read -p "Press [Enter] to return to the main menu."
}

# Display daemon status and log stream
view_logs() {
    show_banner
    echo -e "${YELLOW}${BOLD}Systemd Daemon Status:${NC}"
    systemctl status "$SERVICE_NAME" --no-pager
    echo ""
    echo -e "${YELLOW}${BOLD}Recent Bot Activity Logs (Press Ctrl+C to exit log streaming):${NC}"
    journalctl -u "$SERVICE_NAME" -n 50 -f
}

# Main Event Loop Menu
while true; do
    show_banner
    echo -e "${BOLD}Please select an action to execute:${NC}"
    echo -e "  ${CYAN}1)${NC} ${BOLD}Install / Re-install Bot${NC}"
    echo -e "  ${CYAN}2)${NC} Update Bot to Latest Version"
    echo -e "  ${CYAN}3)${NC} ${RED}Uninstall Bot completely${NC}"
    echo -e "  ${CYAN}4)${NC} Configure Admin Telegram ID & Token"
    echo -e "  ${CYAN}5)${NC} Check Bot Status & View Log Stream"
    echo -e "  ${CYAN}6)${NC} Exit Installer"
    echo ""
    read -p "Enter menu selection [1-6]: " choice

    case "$choice" in
        1) install_bot ;;
        2) update_bot ;;
        3) uninstall_bot ;;
        4) configure_credentials ;;
        5) view_logs ;;
        6) 
            echo -e "${GREEN}Thank you for using V2Ray Extractor Bot! Goodbye.${NC}"
            exit 0
            ;;
        *) 
            echo -e "${RED}Invalid selection. Please enter a number between 1 and 6.${NC}"
            sleep 1.5
            ;;
    esac
done
