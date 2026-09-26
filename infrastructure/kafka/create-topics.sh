#!/bin/sh
# Creates CodeMate's Kafka topics (docs/events/kafka-events.md). Idempotent.
# Usage: create-topics.sh <bootstrap-server>
set -e
BOOTSTRAP="${1:-localhost:9092}"
BIN=/opt/kafka/bin/kafka-topics.sh

# topic:partitions. Game and analysis topics are keyed by gameId, code topics
# by userId, so per-key ordering is preserved inside a partition.
for spec in \
  codemate.game.created:3 \
  codemate.game.move:6 \
  codemate.game.finished:3 \
  codemate.analysis.requested:3 \
  codemate.analysis.completed:3 \
  codemate.code.submitted:3 \
  codemate.code.completed:3 \
  codemate.ai.chat.completed:3 \
  codemate.matchmaking.matched:1 \
  codemate.rating.updated:1
do
  topic="${spec%%:*}"
  partitions="${spec##*:}"
  $BIN --bootstrap-server "$BOOTSTRAP" --create --if-not-exists --topic "$topic" \
    --partitions "$partitions" --replication-factor 1 --config retention.ms=604800000
done
$BIN --bootstrap-server "$BOOTSTRAP" --list
