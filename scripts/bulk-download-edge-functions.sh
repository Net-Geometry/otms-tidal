# --- CONFIGURATION ---
PROJECT_REF="kamtarwxydftzpewcgzs"
# ---------------------
echo "🔍 Fetching function list from project: $PROJECT_REF"

# 1. List functions
# 2. Skip the first 2 lines (Header and dashed separator)
# 3. Use '|' as the separator and print the 2nd column (NAME)
# 4. Use xargs to trim the whitespace around the name
FUNC_NAMES=$(supabase functions list --project-ref "$PROJECT_REF" | tail -n +3 | awk -F '|' '{print $2}' | xargs)

if [ -z "$FUNC_NAMES" ]; then
    echo "❌ No functions found or unable to parse list."
    exit 1
fi

echo "✅ Found functions: $FUNC_NAMES"
echo "⬇️ Starting download..."

for NAME in $FUNC_NAMES; do
    echo "---------------------------------------------------"
    echo "📦 Downloading function: '$NAME'..."
    
    # Download by NAME, not ID
    supabase functions download "$NAME" --project-ref "$PROJECT_REF"
    
    if [ $? -eq 0 ]; then
        echo "✅ Success!"
    else
        echo "❌ Failed."
    fi
done

echo "---------------------------------------------------"
echo "🎉 All done."