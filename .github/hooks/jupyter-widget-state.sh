#!/bin/bash

# pre-commit hook to add missing widget state to Jupyter notebooks
# so they can be rendered in Github

for file in "$@"; do
    if [ -f "$file" ] && [[ "$file" == *.ipynb ]]; then
        tempfile=$(mktemp)
        jq '.metadata.widgets."application/vnd.jupyter.widget-state+json" += {"state": {}}' "$file" > "$tempfile"
        cp "$tempfile" "$file"
        rm "$tempfile"
    fi
done

exit 0
