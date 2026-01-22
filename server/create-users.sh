#!/bin/bash

# Script tao 2 tai khoan mac dinh
# Cach su dung: Dam bao server dang chay (npm run dev), sau do chay script nay

BASE_URL="http://localhost:5000/api/auth/register"

echo "Dang tao tai khoan..."
echo ""

# Kiem tra server co dang chay khong
if ! curl -s -f -o /dev/null http://localhost:5000/health 2>/dev/null; then
    echo "Loi: Server khong dang chay hoac khong the ket noi!"
    echo "Vui long chay: cd server && npm run dev"
    exit 1
fi

# Function de tao user
create_user() {
    local username=$1
    local email=$2
    local password=$3
    local role=$4
    local location=$5

    JSON_DATA=$(cat <<EOF
{
    "username": "$username",
    "email": "$email",
    "password": "$password",
    "role": "$role",
    "location": "$location"
}
EOF
)

    # Su dung curl voi timeout va error handling
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL" \
        -H "Content-Type: application/json" \
        -d "$JSON_DATA" \
        --connect-timeout 5 \
        --max-time 10 2>&1)
    
    # Tach HTTP code va body
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    # Kiem tra neu HTTP_CODE khong phai la so (co the la error message)
    if ! [[ "$HTTP_CODE" =~ ^[0-9]+$ ]]; then
        echo "Loi khi tao $username: Khong the ket noi den server"
        echo "   Kiem tra xem server co dang chay khong (npm run dev)"
        echo ""
        return 1
    fi

    if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
        echo "Da tao tai khoan: $username"
        echo "   Email: $email"
        echo "   Role: $role"
        echo ""
        return 0
    elif [ "$HTTP_CODE" -eq 400 ]; then
        # Tim error message trong response
        ERROR_MSG=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 || echo "")
        if [ "$ERROR_MSG" = "User already exists" ]; then
            echo "Tai khoan $username da ton tai (bo qua)"
            echo ""
            return 0
        else
            echo "Loi khi tao $username: $ERROR_MSG"
            echo "   Response: $BODY"
            echo ""
            return 1
        fi
    else
        echo "Loi khi tao $username (HTTP $HTTP_CODE)"
        echo "   Response: $BODY"
        echo ""
        return 1
    fi
}

# Tao user buyer
create_user "buyer" "buyer@rmg.vn" "RMG123@" "BUYER" "HCM"

# Tao user buyer_manage
create_user "buyer_manage" "buyer_manage@rmg.vn" "RMG123@" "BUYER" "HCM"

echo "Hoan thanh!"
echo ""
echo "Thong tin dang nhap:"
echo "   Username: buyer hoac buyer_manage"
echo "   Password: RMG123@"
echo ""
