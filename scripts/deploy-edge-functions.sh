#!/bin/bash

# --- CONFIGURATION ---
# Replace these with your actual Project Reference IDs
STAGING_REF="bnugqluakoebvqjseunv"
PROD_REF="kamtarwxydftzpewcgzs"
# ---------------------

echo "🚀 Supabase Edge Functions Deployment Manager"
echo "---------------------------------------------"
echo "Select the environment to deploy to:"
echo "1) Staging ($STAGING_REF)"
echo "2) Production ($PROD_REF)"
echo "---------------------------------------------"
read -p "Enter choice [1 or 2]: " choice

# Set the Target Ref based on user input
if [ "$choice" == "1" ]; then
    TARGET_REF="$STAGING_REF"
    ENV_NAME="Staging"
elif [ "$choice" == "2" ]; then
    TARGET_REF="$PROD_REF"
    ENV_NAME="Production"
    
    # Extra safety check for Production
    read -p "⚠️  Are you sure you want to deploy to PRODUCTION? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "❌ Aborted."
        exit 1
    fi
else
    echo "❌ Invalid choice."
    exit 1
fi

echo "---------------------------------------------"
echo "🔥 Deploying ALL functions to $ENV_NAME..."
echo "---------------------------------------------"

# 1. Deploy all functions found in supabase/functions folder
supabase functions deploy --project-ref "$TARGET_REF"

# Check if deploy succeeded
if [ $? -eq 0 ]; then
    echo "---------------------------------------------"
    echo "✅ Success! All functions are live on $ENV_NAME."
    
    # Optional: Remind about secrets
    echo "💡 Note: If you added new .env secrets, remember to run:"
    echo "   supabase secrets set --env-file ./supabase/.env --project-ref $TARGET_REF"
else
    echo "---------------------------------------------"
    echo "❌ Deployment failed."
fi