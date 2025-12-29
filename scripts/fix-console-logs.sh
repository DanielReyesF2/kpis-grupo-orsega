#!/bin/bash

# Script to replace console.log with devLog in client files

FILES=$(find client/src/components client/src/pages client/src/hooks -type f \( -name "*.tsx" -o -name "*.ts" \) | xargs grep -l "console\.\(log\|warn\|error\)" 2>/dev/null | grep -v "logger.ts" | grep -v "queryClient.ts")

for file in $FILES; do
  echo "Processing: $file"

  # Check if devLog import already exists
  if ! grep -q "from '@/lib/logger'" "$file" && ! grep -q 'from "@/lib/logger"' "$file"; then
    # Add import at the beginning of the file, after first import
    sed -i '1s/^/import { devLog } from "@\/lib\/logger";\n/' "$file"
    echo "  Added import"
  fi

  # Replace console.log with devLog.log
  sed -i 's/console\.log(/devLog.log(/g' "$file"
  sed -i 's/console\.warn(/devLog.warn(/g' "$file"
  sed -i 's/console\.error(/devLog.error(/g' "$file"
  sed -i 's/console\.debug(/devLog.debug(/g' "$file"
  sed -i 's/console\.info(/devLog.info(/g' "$file"

  echo "  Replaced console calls"
done

echo "Done!"
