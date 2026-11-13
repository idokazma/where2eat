#!/bin/bash
# Script to create the GitHub issue for Restaurant Display PRD
# Run: gh auth login (if not already authenticated)
# Then: bash scripts/create-prd-issue.sh

ISSUE_TITLE="[PRD] Restaurant Display Design - Feed Cards & Detail Page Specification"
ISSUE_BODY_FILE="docs/PRD-restaurant-display.md"

# Remove the H1 title from the body since it becomes the issue title
BODY=$(tail -n +3 "$ISSUE_BODY_FILE")

gh issue create \
  --repo idokazma/where2eat \
  --title "$ISSUE_TITLE" \
  --label "enhancement,documentation" \
  --body "$BODY"
