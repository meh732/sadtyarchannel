#!/bin/bash

# ==============================================================================
# Telegram V2Ray & Proxy Extractor Bot - Sanaei Style Installer & Manager
# GitHub: https://github.com/meh732/sadtyarchannel.git
# ==============================================================================

# Color Codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
PLAIN='\033[0m'
BOLD='\033[1m'

# Paths
INSTALL_DIR="/opt/sadtyar-bot"
SERVICE_NAME="sadtyar-bot"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
BIN_CMD="/usr/local/bin/sadtyar"
REPO_URL="https://github.com/meh732/sadtyarchannel.git"
ZIP_URL="https://github.com/meh732/sadtyarchannel/archive/refs/heads/main.zip"

# Check root privileges
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}${BOLD}Error: Please run this script with root privileges (sudo bash).${PLAIN}"
    exit 1
fi

show_banner() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "=================================================================="
    echo "  ███████╗ █████╗ ██████╗ ████████╗██╗   ██╗ █████╗ ██████╗ "
    echo "  ██╔════╝██╔══██╗██╔══██╗╚══██╔══╝╚██╗ ██╔╝██╔══██╗██╔══██╗"
    echo "  ███████╗███████║██║  ██║   ██║    ╚████╔╝ ███████║██████╔╝"
    echo "  ╚════██║██╔══██║██║  ██║   ██║     ╚██╔╝  ██╔══██║██╔══██╗"
    echo "  ███████║██║  ██║██████╔╝   ██║      ██║   ██║  ██║██║  ██║"
    echo "  ╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝      ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝"
    echo "=================================================================="
    echo -e "       Telegram V2Ray Proxy Extractor & Auto-Poster Bot           "
    echo -e "              Sanaei Style Installer & Manager v2.5               "
    echo -e "==================================================================${PLAIN}"
    echo ""
}

# Install System Dependencies
install_system_deps() {
    echo -e "${BLUE}[1/5] Checking and installing system dependencies...${PLAIN}"
    
    if [ -f /etc/debian_version ]; then
        PM="apt-get"
        echo -e "${GREEN}Detected OS: Debian / Ubuntu${PLAIN}"
        apt-get update -y >/dev/null 2>&1
        apt-get install -y curl git wget unzip build-essential tar socat >/dev/null 2>&1
    elif [ -f /etc/redhat-release ]; then
        PM="yum"
        echo -e "${GREEN}Detected OS: CentOS / RHEL / Fedora / AlmaLinux${PLAIN}"
        yum update -y >/dev/null 2>&1
        yum groupinstall -y "Development Tools" >/dev/null 2>&1
        yum install -y curl git wget unzip tar socat >/dev/null 2>&1
    else
        PM="apt-get"
        apt-get update -y >/dev/null 2>&1
        apt-get install -y curl git wget unzip build-essential tar >/dev/null 2>&1
    fi

    # Check for Node.js (v20 LTS recommended)
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${YELLOW}Node.js not found. Installing Node.js v20 LTS...${PLAIN}"
        if [ "$PM" = "apt-get" ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            apt-get install -y nodejs >/dev/null 2>&1
        else
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            yum install -y nodejs >/dev/null 2>&1
        fi
    fi

    echo -e "Node.js Version: ${GREEN}$(node -v 2>/dev/null || echo 'Unknown')${PLAIN}"
    echo -e "NPM Version:     ${GREEN}$(npm -v 2>/dev/null || echo 'Unknown')${PLAIN}"
    echo ""
}

# Install / Download Xray Core
install_xray_core() {
    echo -e "${BLUE}[2/5] Setting up Xray Core engine...${PLAIN}"
    mkdir -p "$INSTALL_DIR/bin"
    if [ ! -f "$INSTALL_DIR/bin/xray" ]; then
        ARCH=$(uname -m)
        XRAY_ARCH="64"
        if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
            XRAY_ARCH="arm64-v8a"
        fi
        
        echo -e "Downloading Xray Core Linux ${XRAY_ARCH} binary..."
        wget -q "https://github.com/XTLS/Xray-core/releases/download/v1.8.24/Xray-linux-${XRAY_ARCH}.zip" -O /tmp/xray.zip
        if [ -f /tmp/xray.zip ]; then
            unzip -q -o /tmp/xray.zip -d /tmp/xray_extract
            mv /tmp/xray_extract/xray "$INSTALL_DIR/bin/xray" 2>/dev/null || true
            chmod +x "$INSTALL_DIR/bin/xray" 2>/dev/null || true
            rm -rf /tmp/xray.zip /tmp/xray_extract
            echo -e "${GREEN}Xray Core successfully configured.${PLAIN}"
        fi
    else
        chmod +x "$INSTALL_DIR/bin/xray" 2>/dev/null || true
        echo -e "${GREEN}Xray Core is already present.${PLAIN}"
    fi
    echo ""
}

# Prompt user for credentials
prompt_credentials() {
    echo -e "${BLUE}[3/5] Bot Configuration & Admin Credentials${PLAIN}"
    
    # Prompt for Admin Telegram ID
    while true; do
        read -p "Admin Telegram Numeric ID (e.g. 12345678): " admin_id
        if [[ "$admin_id" =~ ^[0-9]+$ ]]; then
            break
        else
            echo -e "${RED}Error: Admin ID must contain digits only.${PLAIN}"
        fi
    done

    # Prompt for Telegram Bot Token
    while true; do
        read -p "Telegram Bot Token (from @BotFather): " bot_token
        if [[ "$bot_token" =~ ^[0-9]+:[a-zA-Z0-9_-]+$ ]]; then
            break
        else
            echo -e "${RED}Error: Invalid token format (e.g. 123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ).${PLAIN}"
        fi
    done

    # Prompt for Web Panel Port
    while true; do
        read -p "Web Panel Port [default: 3000]: " web_port
        if [ -z "$web_port" ]; then
            web_port="3000"
            break
        elif [[ "$web_port" =~ ^[0-9]+$ ]] && [ "$web_port" -ge 1 ] && [ "$web_port" -le 65535 ]; then
            break
        else
            echo -e "${RED}Error: Port must be a number between 1 and 65535.${PLAIN}"
        fi
    done
    # Prompt for Admin Username
    read -p "Web Panel Username [default: admin]: " admin_username
    if [ -z "$admin_username" ]; then
        admin_username="admin"
    fi

    # Prompt for Admin Password
    read -p "Web Panel Password [default: admin]: " admin_password
    if [ -z "$admin_password" ]; then
        admin_password="admin"
    fi

    echo ""
}

# Install or Reinstall Bot
install_bot() {
    show_banner
    echo -e "${YELLOW}${BOLD}Starting Sadtyar Bot Installation...${PLAIN}\n"
    
    # 1. Dependencies
    install_system_deps
    
    # 2. Directory Setup & Clone
    echo -e "${BLUE}[3/5] Fetching project source code...${PLAIN}"
    mkdir -p "$INSTALL_DIR"
    
    if [ -f "./package.json" ] && [ -f "./server.ts" ]; then
        echo -e "Copying files from current directory..."
        cp -rf ./* "$INSTALL_DIR/" 2>/dev/null || true
        cp -rf ./.* "$INSTALL_DIR/" 2>/dev/null || true
    else
        echo -e "Downloading latest release package from GitHub..."
        rm -rf "$INSTALL_DIR"
        mkdir -p "$INSTALL_DIR"
        wget -q "$ZIP_URL" -O /tmp/sadtyar_main.zip
        if [ -f /tmp/sadtyar_main.zip ]; then
            unzip -q -o /tmp/sadtyar_main.zip -d /tmp/sadtyar_extract
            cp -rf /tmp/sadtyar_extract/sadtyarchannel-main/* "$INSTALL_DIR/" 2>/dev/null || true
            cp -rf /tmp/sadtyar_extract/sadtyarchannel-main/.* "$INSTALL_DIR/" 2>/dev/null || true
            rm -rf /tmp/sadtyar_main.zip /tmp/sadtyar_extract
        else
            git clone "$REPO_URL" "$INSTALL_DIR"
        fi
    fi

    cd "$INSTALL_DIR" || exit 1

    # 3. Setup Xray Core
    install_xray_core

    # 4. Prompt Credentials
    prompt_credentials

    # 5. Stop existing service
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${YELLOW}Stopping existing background service...${PLAIN}"
        systemctl stop "$SERVICE_NAME"
    fi

    # 6. Write Environment File
    echo -e "${BLUE}[4/5] Creating environment config file (.env)...${PLAIN}"
    server_ip=$(curl -s https://api.ipify.org || wget -qO- https://api.ipify.org || echo "127.0.0.1")
    app_url="http://${server_ip}:${web_port}"
    cat <<EOF > "$INSTALL_DIR/.env"
APP_URL="${app_url}"
NODE_ENV=production
ADMIN_ID="${admin_id}"
BOT_TOKEN="${bot_token}"
PORT="${web_port}"
ADMIN_USERNAME="${admin_username:-admin}"
ADMIN_PASSWORD="${admin_password:-admin}"
EOF

    # 7. Build and Compile
    echo -e "${BLUE}[5/5] Installing npm dependencies & compiling application...${PLAIN}"
    npm install --production=false
    npm run build

    # 8. Create Systemd Service
    echo -e "Creating systemd background service (${SERVICE_NAME})..."
    cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Sadtyar Telegram V2Ray Extractor & Auto-Poster Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3
EnvironmentFile=${INSTALL_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF

    # 9. Register shortcut CLI command
    cat <<'EOF' > "$BIN_CMD"
#!/bin/bash
if [ -f "/opt/sadtyar-bot/install.sh" ]; then
    bash /opt/sadtyar-bot/install.sh
else
    echo "Sadtyar installation not found."
fi
EOF
    chmod +x "$BIN_CMD"
    chmod +x "$INSTALL_DIR/install.sh" 2>/dev/null || true

    # 10. Start and Enable Service
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
    systemctl restart "$SERVICE_NAME"

    # Get Server IP
    SERVER_IP=$(curl -s4 ifconfig.me || curl -s4 api.ipify.org || echo "Server-IP")

    echo ""
    echo -e "=================================================================="
    echo -e "${GREEN}${BOLD}🎉 Installation completed successfully!${PLAIN}"
    echo -e "=================================================================="
    echo -e "Admin ID:        ${CYAN}${admin_id}${PLAIN}"
    echo -e "Service Status:  ${GREEN}Active & Auto-start on boot${PLAIN}"
    echo -e "Install Path:    ${YELLOW}${INSTALL_DIR}${PLAIN}"
    echo -e "Web Panel URL:   ${CYAN}http://${SERVER_IP}:${web_port}${PLAIN}"
    echo -e "Management CLI:  ${PURPLE}${BOLD}sadtyar${PLAIN}"
    echo -e "=================================================================="
    echo -e "You can manage the bot in Telegram with: ${GREEN}/admin${PLAIN}"
    echo -e "Type ${CYAN}sadtyar${PLAIN} anytime in your terminal to open this manager."
    echo -e "=================================================================="
    read -p "Press Enter to return to main menu..."
}

# Update Bot
update_bot() {
    show_banner
    echo -e "${YELLOW}${BOLD}Updating Sadtyar Bot to the latest version...${PLAIN}\n"

    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "${RED}Error: Bot is not installed in $INSTALL_DIR.${PLAIN}"
        echo -e "Please run option [1] (Install) first."
        read -p "Press Enter to return..."
        return
    fi

    cd "$INSTALL_DIR" || exit 1

    echo -e "${BLUE}Temporarily stopping service...${PLAIN}"
    systemctl stop "$SERVICE_NAME"

    echo -e "${BLUE}Creating safe backup of database, settings & .env...${PLAIN}"
    mkdir -p /tmp/sadtyar_safe_backup
    [ -f "$INSTALL_DIR/data_store.json" ] && cp -f "$INSTALL_DIR/data_store.json" /tmp/sadtyar_safe_backup/
    [ -f "$INSTALL_DIR/system_settings.json" ] && cp -f "$INSTALL_DIR/system_settings.json" /tmp/sadtyar_safe_backup/
    [ -f "$INSTALL_DIR/data_store.json.bak" ] && cp -f "$INSTALL_DIR/data_store.json.bak" /tmp/sadtyar_safe_backup/
    [ -f "$INSTALL_DIR/system_settings.json.bak" ] && cp -f "$INSTALL_DIR/system_settings.json.bak" /tmp/sadtyar_safe_backup/
    [ -f "$INSTALL_DIR/.env" ] && cp -f "$INSTALL_DIR/.env" /tmp/sadtyar_safe_backup/

    echo -e "${BLUE}Downloading latest update package from GitHub...${PLAIN}"
    
    # Download latest repository zip archive directly without password prompt
    wget -q "$ZIP_URL" -O /tmp/sadtyar_update.zip
    if [ -f /tmp/sadtyar_update.zip ]; then
        unzip -q -o /tmp/sadtyar_update.zip -d /tmp/sadtyar_update_extract
        if [ -d "/tmp/sadtyar_update_extract/sadtyarchannel-main" ]; then
            cp -rf /tmp/sadtyar_update_extract/sadtyarchannel-main/* "$INSTALL_DIR/" 2>/dev/null || true
            cp -rf /tmp/sadtyar_update_extract/sadtyarchannel-main/.* "$INSTALL_DIR/" 2>/dev/null || true
        fi
        rm -rf /tmp/sadtyar_update.zip /tmp/sadtyar_update_extract
        echo -e "${GREEN}Latest files downloaded successfully.${PLAIN}"
    else
        # Fallback to non-interactive git pull
        GIT_TERMINAL_PROMPT=0 git stash 2>/dev/null || true
        GIT_TERMINAL_PROMPT=0 git pull origin main || GIT_TERMINAL_PROMPT=0 git pull origin master || true
    fi

    echo -e "${BLUE}Restoring database and configuration files...${PLAIN}"
    [ -f /tmp/sadtyar_safe_backup/data_store.json ] && cp -f /tmp/sadtyar_safe_backup/data_store.json "$INSTALL_DIR/"
    [ -f /tmp/sadtyar_safe_backup/system_settings.json ] && cp -f /tmp/sadtyar_safe_backup/system_settings.json "$INSTALL_DIR/"
    [ -f /tmp/sadtyar_safe_backup/data_store.json.bak ] && cp -f /tmp/sadtyar_safe_backup/data_store.json.bak "$INSTALL_DIR/"
    [ -f /tmp/sadtyar_safe_backup/system_settings.json.bak ] && cp -f /tmp/sadtyar_safe_backup/system_settings.json.bak "$INSTALL_DIR/"
    [ -f /tmp/sadtyar_safe_backup/.env ] && cp -f /tmp/sadtyar_safe_backup/.env "$INSTALL_DIR/"
    rm -rf /tmp/sadtyar_safe_backup

    install_xray_core

    echo -e "${BLUE}Installing dependencies and building bundle...${PLAIN}"
    npm install --production=false
    npm run build

    echo -e "${BLUE}Restarting systemd service...${PLAIN}"
    systemctl daemon-reload
    systemctl restart "$SERVICE_NAME"

    echo -e "${GREEN}${BOLD}🎉 Update completed successfully! Database and configs preserved.${PLAIN}"
    read -p "Press Enter to return..."
}

# Uninstall Bot
uninstall_bot() {
    show_banner
    echo -e "${RED}${BOLD}🚨 Complete Removal of Sadtyar Bot${PLAIN}"
    read -p "Are you sure you want to completely uninstall the bot and all its files? (y/n): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Uninstall cancelled.${PLAIN}"
        read -p "Press Enter to return..."
        return
    fi

    echo -e "${BLUE}Stopping and disabling service...${PLAIN}"
    systemctl stop "$SERVICE_NAME" >/dev/null 2>&1
    systemctl disable "$SERVICE_NAME" >/dev/null 2>&1

    echo -e "${BLUE}Removing service and CLI shortcuts...${PLAIN}"
    rm -f "$SERVICE_FILE"
    rm -f "$BIN_CMD"
    systemctl daemon-reload

    echo -e "${BLUE}Removing installation directory: $INSTALL_DIR...${PLAIN}"
    rm -rf "$INSTALL_DIR"

    echo -e "${GREEN}${BOLD}🗑️ Sadtyar Bot has been completely removed from this server.${PLAIN}"
    read -p "Press Enter to return..."
}

# Modify Credentials
configure_credentials() {
    show_banner
    echo -e "${YELLOW}${BOLD}Modify Bot Token, Admin ID & Web Port${PLAIN}\n"

    if [ ! -f "$INSTALL_DIR/.env" ]; then
        echo -e "${RED}Error: Config file $INSTALL_DIR/.env not found.${PLAIN}"
        read -p "Press Enter to return..."
        return
    fi

    current_admin=$(grep -oP 'ADMIN_ID="\K[^"]+' "$INSTALL_DIR/.env" || echo "")
    current_token=$(grep -oP 'BOT_TOKEN="\K[^"]+' "$INSTALL_DIR/.env" || echo "")
    current_port=$(grep -oP 'PORT="\K[^"]+' "$INSTALL_DIR/.env" || echo "3000")

    echo -e "Current Admin ID:  ${CYAN}$current_admin${PLAIN}"
    echo -e "Current Bot Token: ${CYAN}$current_token${PLAIN}"
    echo -e "Current Web Port:  ${CYAN}$current_port${PLAIN}\n"

    prompt_credentials

    server_ip=$(curl -s https://api.ipify.org || wget -qO- https://api.ipify.org || echo "127.0.0.1")
    app_url="http://${server_ip}:${web_port}"
    cat <<EOF > "$INSTALL_DIR/.env"
APP_URL="${app_url}"
NODE_ENV=production
ADMIN_ID="${admin_id}"
BOT_TOKEN="${bot_token}"
PORT="${web_port}"
ADMIN_USERNAME="${admin_username:-admin}"
ADMIN_PASSWORD="${admin_password:-admin}"
EOF

    echo -e "${BLUE}Applying changes and restarting service...${PLAIN}"
    systemctl restart "$SERVICE_NAME"

    echo -e "${GREEN}${BOLD}✅ New configuration saved and service restarted.${PLAIN}"
    read -p "Press Enter to return..."
}

# Service Management Functions
start_service() {
    systemctl start "$SERVICE_NAME"
    echo -e "${GREEN}Service started successfully.${PLAIN}"
    sleep 1.5
}

stop_service() {
    systemctl stop "$SERVICE_NAME"
    echo -e "${YELLOW}Service stopped.${PLAIN}"
    sleep 1.5
}

restart_service() {
    systemctl restart "$SERVICE_NAME"
    echo -e "${GREEN}Service restarted successfully.${PLAIN}"
    sleep 1.5
}

# View Logs
view_logs() {
    show_banner
    echo -e "${YELLOW}${BOLD}Systemd Service Status:${PLAIN}"
    systemctl status "$SERVICE_NAME" --no-pager
    echo ""
    echo -e "${YELLOW}${BOLD}Live Bot Logs (Press Ctrl+C to exit):${PLAIN}"
    journalctl -u "$SERVICE_NAME" -n 50 -f
}

# Main Menu Loop
while true; do
    show_banner
    
    # Check if service is active
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        STATUS_LABEL="${GREEN}Active (Running)${PLAIN}"
    else
        STATUS_LABEL="${RED}Inactive (Stopped)${PLAIN}"
    fi

    echo -e "Service Status:  ${STATUS_LABEL}"
    echo -e "Management CLI:  ${PURPLE}${BOLD}sadtyar${PLAIN}"
    echo "------------------------------------------------------------------"
    echo -e "  ${CYAN}1)${PLAIN} ${BOLD}Install / Reinstall Bot (Install)${PLAIN}"
    echo -e "  ${CYAN}2)${PLAIN} Update Bot to Latest Version (Update)"
    echo -e "  ${CYAN}3)${PLAIN} Modify Bot Token, Admin ID & Web Port"
    echo -e "  ${CYAN}4)${PLAIN} ${GREEN}Start Bot Service (Start)${PLAIN}"
    echo -e "  ${CYAN}5)${PLAIN} ${YELLOW}Stop Bot Service (Stop)${PLAIN}"
    echo -e "  ${CYAN}6)${PLAIN} Restart Bot Service (Restart)"
    echo -e "  ${CYAN}7)${PLAIN} View Status & Live Logs (Logs)"
    echo -e "  ${CYAN}8)${PLAIN} Download / Reinstall Xray Core Engine"
    echo -e "  ${CYAN}9)${PLAIN} ${RED}Uninstall Bot Completely (Uninstall)${PLAIN}"
    echo -e "  ${CYAN}0)${PLAIN} Exit Manager (Exit)"
    echo "------------------------------------------------------------------"
    read -p "Please select an option [0-9]: " choice

    case "$choice" in
        1) install_bot ;;
        2) update_bot ;;
        3) configure_credentials ;;
        4) start_service ;;
        5) stop_service ;;
        6) restart_service ;;
        7) view_logs ;;
        8) 
            install_xray_core
            restart_service
            read -p "Press Enter to return..."
            ;;
        9) uninstall_bot ;;
        0) 
            echo -e "${GREEN}Goodbye!${PLAIN}"
            exit 0
            ;;
        *) 
            echo -e "${RED}Invalid selection.${PLAIN}"
            sleep 1
            ;;
    esac
done
