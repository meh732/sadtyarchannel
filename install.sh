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

# Check root privileges
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}${BOLD}خطا: لطفاً این اسکریپت را با دسترسی روت اجرا کنید (sudo bash).${PLAIN}"
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
    echo -e "       ربات هوشمند استخراج و مدیریت کانفیگ ویتوری و تلگرام         "
    echo -e "              Sanaei Style Installer & Manager v2.0               "
    echo -e "==================================================================${PLAIN}"
    echo ""
}

# Install System Dependencies
install_system_deps() {
    echo -e "${BLUE}[1/5] در حال بررسی و نصب نیازمندی‌های سیستم...${PLAIN}"
    
    if [ -f /etc/debian_version ]; then
        PM="apt-get"
        echo -e "${GREEN}سیستم عامل شناسایی شده: دبیان / اوبونتو${PLAIN}"
        apt-get update -y >/dev/null 2>&1
        apt-get install -y curl git wget unzip build-essential tar socat >/dev/null 2>&1
    elif [ -f /etc/redhat-release ]; then
        PM="yum"
        echo -e "${GREEN}سیستم عامل شناسایی شده: سنت‌او‌اس / ردهت / فدورا${PLAIN}"
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
        echo -e "${YELLOW}نود جی‌اس نصب نیست. در حال نصب Node.js v20 LTS...${PLAIN}"
        if [ "$PM" = "apt-get" ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            apt-get install -y nodejs >/dev/null 2>&1
        else
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            yum install -y nodejs >/dev/null 2>&1
        fi
    fi

    echo -e "نسخه نود جی‌اس: ${GREEN}$(node -v 2>/dev/null || echo 'نامشخص')${PLAIN}"
    echo -e "نسخه ان‌پی‌ام:   ${GREEN}$(npm -v 2>/dev/null || echo 'نامشخص')${PLAIN}"
    echo ""
}

# Install / Download Xray Core
install_xray_core() {
    echo -e "${BLUE}[2/5] در حال دانلود و تنظیم هسته Xray Core...${PLAIN}"
    mkdir -p "$INSTALL_DIR/bin"
    if [ ! -f "$INSTALL_DIR/bin/xray" ]; then
        ARCH=$(uname -m)
        XRAY_ARCH="64"
        if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
            XRAY_ARCH="arm64-v8a"
        fi
        
        echo -e "در حال دانلود هسته Xray نسخه Linux ${XRAY_ARCH}..."
        wget -q "https://github.com/XTLS/Xray-core/releases/download/v1.8.24/Xray-linux-${XRAY_ARCH}.zip" -O /tmp/xray.zip
        if [ -f /tmp/xray.zip ]; then
            unzip -q -o /tmp/xray.zip -d /tmp/xray_extract
            mv /tmp/xray_extract/xray "$INSTALL_DIR/bin/xray" 2>/dev/null || true
            chmod +x "$INSTALL_DIR/bin/xray" 2>/dev/null || true
            rm -rf /tmp/xray.zip /tmp/xray_extract
            echo -e "${GREEN}هسته Xray Core با موفقیت دانلود و تنظیم شد.${PLAIN}"
        fi
    else
        chmod +x "$INSTALL_DIR/bin/xray" 2>/dev/null || true
        echo -e "${GREEN}هسته Xray Core از قبل موجود است.${PLAIN}"
    fi
    echo ""
}

# Prompt user for credentials
prompt_credentials() {
    echo -e "${BLUE}[3/5] پیکربندی و ورود اطلاعات مدیریت ربات${PLAIN}"
    
    # Prompt for Admin Telegram ID
    while true; do
        read -p "آیدی عددی تلگرام ادمین (Admin Numerical ID): " admin_id
        if [[ "$admin_id" =~ ^[0-9]+$ ]]; then
            break
        else
            echo -e "${RED}خطا: آیدی عددی باید فقط شامل ارقام باشد.${PLAIN}"
        fi
    done

    # Prompt for Telegram Bot Token
    while true; do
        read -p "توکن ربات تلگرام (از @BotFather): " bot_token
        if [[ "$bot_token" =~ ^[0-9]+:[a-zA-Z0-9_-]+$ ]]; then
            break
        else
            echo -e "${RED}خطا: فرمت توکن نامعتبر است (مثال: 123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ).${PLAIN}"
        fi
    done

    # Prompt for Web Panel Port
    while true; do
        read -p "پورت وب‌پنل مدیریت [پیش‌فرض: 3000]: " web_port
        if [ -z "$web_port" ]; then
            web_port="3000"
            break
        elif [[ "$web_port" =~ ^[0-9]+$ ]] && [ "$web_port" -ge 1 ] && [ "$web_port" -le 65535 ]; then
            break
        else
            echo -e "${RED}خطا: پورت باید عددی بین ۱ تا ۶۵۵۳۵ باشد.${PLAIN}"
        fi
    done
    echo ""
}

# Install or Reinstall Bot
install_bot() {
    show_banner
    echo -e "${YELLOW}${BOLD}شروع فرآیند نصب سدتیار...${PLAIN}\n"
    
    # 1. Dependencies
    install_system_deps
    
    # 2. Directory Setup & Clone
    echo -e "${BLUE}[3/5] دریافت سورس پروژه از گیت‌هاب...${PLAIN}"
    mkdir -p "$INSTALL_DIR"
    
    if [ -f "./package.json" ] && [ -f "./server.ts" ]; then
        echo -e "کپی فایل‌ها از دایرکتوری جاری..."
        cp -rf ./* "$INSTALL_DIR/" 2>/dev/null || true
        cp -rf ./.* "$INSTALL_DIR/" 2>/dev/null || true
    else
        echo -e "کلون کردن آخرین نسخه مخزن از گیت‌هاب..."
        rm -rf "$INSTALL_DIR"
        git clone "$REPO_URL" "$INSTALL_DIR"
    fi

    cd "$INSTALL_DIR" || exit 1

    # 3. Setup Xray Core
    install_xray_core

    # 4. Prompt Credentials
    prompt_credentials

    # 5. Stop existing service
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${YELLOW}در حال متوقف‌سازی سرویس قبلی...${PLAIN}"
        systemctl stop "$SERVICE_NAME"
    fi

    # 6. Write Environment File
    echo -e "${BLUE}[4/5] ایجاد فایل تنظیمات محیطی (.env)...${PLAIN}"
    cat <<EOF > "$INSTALL_DIR/.env"
NODE_ENV=production
ADMIN_ID="${admin_id}"
BOT_TOKEN="${bot_token}"
PORT="${web_port}"
EOF

    # 7. Build and Compile
    echo -e "${BLUE}[5/5] نصب پکیج‌ها و کامپایل برنامه...${PLAIN}"
    npm install --production=false
    npm run build

    # 8. Create Systemd Service
    echo -e "ایجاد سرویس سیستمی Systemd (${SERVICE_NAME})..."
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
    SERVER_IP=$(curl -s4 ifconfig.me || curl -s4 api.ipify.org || echo "آی‌پی سرور")

    echo ""
    echo -e "=================================================================="
    echo -e "${GREEN}${BOLD}🎉 فرآیند نصب با موفقیت به اتمام رسید!${PLAIN}"
    echo -e "=================================================================="
    echo -e "آیدی ادمین:      ${CYAN}${admin_id}${PLAIN}"
    echo -e "وضعیت سرویس:     ${GREEN}فعال و استارت خودکار هنگام بوت (Active)${PLAIN}"
    echo -e "مسیر نصب:        ${YELLOW}${INSTALL_DIR}${PLAIN}"
    echo -e "آدرس وب‌پنل:      ${CYAN}http://${SERVER_IP}:${web_port}${PLAIN}"
    echo -e "دستور مدیریت:    ${PURPLE}${BOLD}sadtyar${PLAIN}"
    echo -e "=================================================================="
    echo -e "با ارسال دستور ${GREEN}/admin${PLAIN} در ربات تلگرام می‌توانید آن را مدیریت کنید."
    echo -e "هر زمان در ترمینال دستور ${CYAN}sadtyar${PLAIN} را وارد کنید این منو نمایش داده می‌شود."
    echo -e "=================================================================="
    read -p "جهت بازگشت به منو دکمه اینتر را بزنید..."
}

# Update Bot
update_bot() {
    show_banner
    echo -e "${YELLOW}${BOLD}بروزرسانی ربات سدتیار به آخرین نسخه...${PLAIN}\n"

    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "${RED}خطا: ربات در مسیر $INSTALL_DIR نصب نیست.${PLAIN}"
        echo -e "لطفاً ابتدا گزینه [1] (نصب) را اجرا کنید."
        read -p "اینتر بزنید..."
        return
    fi

    cd "$INSTALL_DIR" || exit 1

    echo -e "${BLUE}متوقف‌سازی موقت سرویس...${PLAIN}"
    systemctl stop "$SERVICE_NAME"

    echo -e "${BLUE}دریافت آخرین کدهای مخزن گیت‌هاب...${PLAIN}"
    if [ -d ".git" ]; then
        git reset --hard HEAD
        git pull origin main || git pull origin master
    else
        git clone "$REPO_URL" /tmp/sadtyar_update
        cp -rf /tmp/sadtyar_update/* "$INSTALL_DIR/"
        rm -rf /tmp/sadtyar_update
    fi

    install_xray_core

    echo -e "${BLUE}نصب نیازمندی‌ها و ساخت مجدد بیلد...${PLAIN}"
    npm install --production=false
    npm run build

    echo -e "${BLUE}راه‌اندازی مجدد سرویس...${PLAIN}"
    systemctl start "$SERVICE_NAME"

    echo -e "${GREEN}${BOLD}🎉 بروزرسانی با موفقیت انجام شد و سرویس مجدداً فعال گردید!${PLAIN}"
    read -p "جهت بازگشت اینتر بزنید..."
}

# Uninstall Bot
uninstall_bot() {
    show_banner
    echo -e "${RED}${BOLD}🚨 حذف کامل ربات و سرویس${PLAIN}"
    read -p "آیا از حذف کامل ربات و کلیه فایل‌های آن اطمینان دارید؟ (y/n): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}عملیات حذف لغو شد.${PLAIN}"
        read -p "اینتر بزنید..."
        return
    fi

    echo -e "${BLUE}توقف و غیرفعال‌سازی سرویس...${PLAIN}"
    systemctl stop "$SERVICE_NAME" >/dev/null 2>&1
    systemctl disable "$SERVICE_NAME" >/dev/null 2>&1

    echo -e "${BLUE}حذف سرویس و فایل‌های اجرایی...${PLAIN}"
    rm -f "$SERVICE_FILE"
    rm -f "$BIN_CMD"
    systemctl daemon-reload

    echo -e "${BLUE}حذف دایرکتوری نصب $INSTALL_DIR...${PLAIN}"
    rm -rf "$INSTALL_DIR"

    echo -e "${GREEN}${BOLD}🗑️ ربات سدتیار با موفقیت از سرور حذف گردید.${PLAIN}"
    read -p "اینتر بزنید..."
}

# Modify Credentials
configure_credentials() {
    show_banner
    echo -e "${YELLOW}${BOLD}تغییر تنظیمات، توکن ربات و آیدی ادمین${PLAIN}\n"

    if [ ! -f "$INSTALL_DIR/.env" ]; then
        echo -e "${RED}خطا: فایل تنظیمات در $INSTALL_DIR/.env یافت نشد.${PLAIN}"
        read -p "اینتر بزنید..."
        return
    fi

    current_admin=$(grep -oP 'ADMIN_ID="\K[^"]+' "$INSTALL_DIR/.env" || echo "")
    current_token=$(grep -oP 'BOT_TOKEN="\K[^"]+' "$INSTALL_DIR/.env" || echo "")
    current_port=$(grep -oP 'PORT="\K[^"]+' "$INSTALL_DIR/.env" || echo "3000")

    echo -e "آیدی ادمین فعلی:   ${CYAN}$current_admin${PLAIN}"
    echo -e "توکن ربات فعلی:    ${CYAN}$current_token${PLAIN}"
    echo -e "پورت وب‌پنل فعلی:  ${CYAN}$current_port${PLAIN}\n"

    prompt_credentials

    cat <<EOF > "$INSTALL_DIR/.env"
NODE_ENV=production
ADMIN_ID="${admin_id}"
BOT_TOKEN="${bot_token}"
PORT="${web_port}"
EOF

    echo -e "${BLUE}اعمال تنظیمات جدید و راه‌اندازی مجدد سرویس...${PLAIN}"
    systemctl restart "$SERVICE_NAME"

    echo -e "${GREEN}${BOLD}✅ تنظیمات با موفقیت ذخیره شد و سرویس ری‌استارت گردید.${PLAIN}"
    read -p "اینتر بزنید..."
}

# Service Management Functions
start_service() {
    systemctl start "$SERVICE_NAME"
    echo -e "${GREEN}سرویس با موفقیت استارت شد.${PLAIN}"
    sleep 1.5
}

stop_service() {
    systemctl stop "$SERVICE_NAME"
    echo -e "${YELLOW}سرویس متوقف گردید.${PLAIN}"
    sleep 1.5
}

restart_service() {
    systemctl restart "$SERVICE_NAME"
    echo -e "${GREEN}سرویس مجدداً راه‌اندازی شد.${PLAIN}"
    sleep 1.5
}

# View Logs
view_logs() {
    show_banner
    echo -e "${YELLOW}${BOLD}وضعیت سرویس ربات در Systemd:${PLAIN}"
    systemctl status "$SERVICE_NAME" --no-pager
    echo ""
    echo -e "${YELLOW}${BOLD}لاگ‌های زنده ربات (برای خروج Ctrl+C را فشار دهید):${PLAIN}"
    journalctl -u "$SERVICE_NAME" -n 50 -f
}

# Main Menu Loop
while true; do
    show_banner
    
    # Check if service is active
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        STATUS_LABEL="${GREEN}فعال (Running)${PLAIN}"
    else
        STATUS_LABEL="${RED}غیرفعال (Stopped)${PLAIN}"
    fi

    echo -e "وضعیت ربات: ${STATUS_LABEL}"
    echo -e "دستور میانبر مدیریت در لینوکس: ${PURPLE}${BOLD}sadtyar${PLAIN}"
    echo "------------------------------------------------------------------"
    echo -e "  ${CYAN}1)${PLAIN} ${BOLD}نصب / نصب مجدد ربات (Install)${PLAIN}"
    echo -e "  ${CYAN}2)${PLAIN} بروزرسانی ربات به آخرین نسخه (Update)"
    echo -e "  ${CYAN}3)${PLAIN} ویرایش توکن ربات، آیدی ادمین و پورت وب‌پنل"
    echo -e "  ${CYAN}4)${PLAIN} ${GREEN}روشن کردن ربات (Start)${PLAIN}"
    echo -e "  ${CYAN}5)${PLAIN} ${YELLOW}خاموش کردن ربات (Stop)${PLAIN}"
    echo -e "  ${CYAN}6)${PLAIN} راه‌اندازی مجدد ربات (Restart)"
    echo -e "  ${CYAN}7)${PLAIN} مشاهده وضعیت و لاگ‌های زنده ربات (Logs)"
    echo -e "  ${CYAN}8)${PLAIN} دانلود / بروزرسانی مجدد هسته Xray Core"
    echo -e "  ${CYAN}9)${PLAIN} ${RED}حذف کامل ربات از سرور (Uninstall)${PLAIN}"
    echo -e "  ${CYAN}0)${PLAIN} خروج از منو (Exit)"
    echo "------------------------------------------------------------------"
    read -p "لطفاً یک گزینه را انتخاب کنید [0-9]: " choice

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
            read -p "اینتر بزنید..."
            ;;
        9) uninstall_bot ;;
        0) 
            echo -e "${GREEN}با تشکر، خروج از اسکریپت.${PLAIN}"
            exit 0
            ;;
        *) 
            echo -e "${RED}گزینه نامعتبر است.${PLAIN}"
            sleep 1
            ;;
    esac
done
