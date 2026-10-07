import { TOPICS } from "../../shared/events.js";

// Kafka implementation of the event bus (kafkajs). Loaded only when
// KAFKA_BROKERS is configured.
export class KafkaBus {
  constructor({ brokers, clientId, log }) {
    this.kind = "kafka";
    this.log = log;
    this.brokers = brokers;
    this.clientId = clientId;
    this.consumers = [];
  }

  async connect() {
    const { Kafka, logLevel } = await import("kafkajs");
    this.kafka = new Kafka({ clientId: this.clientId, brokers: this.brokers, logLevel: logLevel.WARN });
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true, idempotent: true, maxInFlightRequests: 1 });
    await this.producer.connect();
    this.admin = this.kafka.admin();
    await this.admin.connect();
    await this.ensureTopics();
  }

  // Idempotent: existing topics are left alone. Brokers with auto-creation
  // disabled (recommended) need the topics to exist before consumers join.
  async ensureTopics(numPartitions = 3) {
    const existing = new Set(await this.admin.listTopics());
    const missing = Object.values(TOPICS).filter((t) => !existing.has(t));
    if (missing.length) {
      await this.admin.createTopics({ waitForLeaders: true, topics: missing.map((topic) => ({ topic, numPartitions })) });
      this.log.info({ topics: missing }, "Created Kafka topics");
    }
  }

  async publish(topic, event, key) {
    await this.producer.send({
      topic,
      messages: [{ key: key ?? event.payload?.gameId ?? event.payload?.userId ?? event.eventId, value: JSON.stringify(event) }],
    });
  }

  async subscribe(topic, groupId, handler, { retries = 2 } = {}) {
    const consumer = this.kafka.consumer({ groupId, allowAutoTopicCreation: true });
    await consumer.connect();
    // fromBeginning only applies to a brand-new group (no committed offset yet):
    // events published before the group first started are still processed.
    await consumer.subscribe({ topic, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ message }) => {
        const event = JSON.parse(message.value.toString());
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            await handler(event);
            return;
          } catch (err) {
            this.log.error({ err, topic, groupId, attempt, eventId: event.eventId }, "Event handler failed");
          }
        }
        // Handlers are idempotent; after retries the event is skipped (logged) rather than blocking the partition.
      },
    });
    this.consumers.push({ consumer, groupId, topic });
  }

  // Consumer lag per group/topic, for the kafka_consumer_lag metric.
  async lag() {
    const out = [];
    for (const { groupId, topic } of this.consumers) {
      const [latest, committed] = await Promise.all([
        this.admin.fetchTopicOffsets(topic),
        this.admin.fetchOffsets({ groupId, topics: [topic] }),
      ]);
      const committedParts = committed[0]?.partitions || [];
      let total = 0;
      for (const p of latest) {
        const c = committedParts.find((x) => x.partition === p.partition);
        const cOff = c && c.offset !== "-1" ? Number(c.offset) : Number(p.low);
        total += Math.max(0, Number(p.high) - cOff);
      }
      out.push({ groupId, topic, lag: total });
    }
    return out;
  }

  async disconnect() {
    await Promise.allSettled(this.consumers.map((c) => c.consumer.disconnect()));
    await this.producer?.disconnect();
    await this.admin?.disconnect();
  }
}
