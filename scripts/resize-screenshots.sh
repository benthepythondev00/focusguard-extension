#!/bin/bash

# Resize screenshots for Chrome Web Store (1280x800)
# Places the extension popup centered on a gradient background

cd /Users/bengoedeke/Documents/apps/focusguard-extension/store-assets

OUTPUT_DIR="resized"
mkdir -p "$OUTPUT_DIR"

# Background color - light gray gradient effect
BG_COLOR="#f1f5f9"

echo "Creating store screenshots (1280x800)..."

# Process each screenshot - center on background
for i in 1 2 3 4 5 6; do
    case $i in
        1) INPUT="screenshot-1-idle-light.png"; NAME="screenshot-1-idle" ;;
        2) INPUT="screenshot-2-running.png"; NAME="screenshot-2-running" ;;
        3) INPUT="screenshot-3-paused.png"; NAME="screenshot-3-paused" ;;
        4) INPUT="screenshot-4-settings.png"; NAME="screenshot-4-settings" ;;
        5) INPUT="screenshot-5-stats.png"; NAME="screenshot-5-stats" ;;
        6) INPUT="screenshot-6-dark-mode.png"; NAME="screenshot-6-dark-mode" ;;
    esac
    
    if [ -f "$INPUT" ]; then
        # For dark mode, use dark background
        if [ "$i" -eq 6 ]; then
            BG="#1e293b"
        else
            BG="$BG_COLOR"
        fi
        
        echo "  Processing $INPUT -> $NAME-1280x800.png"
        
        # Create 1280x800 canvas with background color, then composite the screenshot centered
        convert -size 1280x800 xc:"$BG" \
            "$INPUT" -gravity center -composite \
            -depth 8 -type TrueColor \
            "$OUTPUT_DIR/${NAME}-1280x800.png"
    fi
done

# Create store icon (128x128) - just copy from public/icon
echo "Copying store icon..."
cp ../public/icon/128.png "$OUTPUT_DIR/store-icon-128x128.png"

# Create promo tile (440x280)
echo "Creating promo tile (440x280)..."
convert -size 440x280 \
    -define gradient:angle=135 \
    gradient:"#ef4444-#f97316" \
    -gravity center \
    -font "Helvetica-Bold" -pointsize 36 -fill white \
    -annotate +0-40 "FocusGuard" \
    -font "Helvetica" -pointsize 18 -fill white \
    -annotate +0+20 "Pomodoro Timer" \
    -font "Helvetica" -pointsize 14 -fill "rgba(255,255,255,0.8)" \
    -annotate +0+50 "Stay Focused. Get More Done." \
    -depth 8 -type TrueColor \
    "$OUTPUT_DIR/promo-tile-440x280.png"

echo ""
echo "Done! Files created in $OUTPUT_DIR/:"
ls -la "$OUTPUT_DIR/"
