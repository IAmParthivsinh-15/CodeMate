import { EventEmitter } from "events";

// In-process event bus used when KAFKA_BROKERS is empty. Same interface as the
// Kafka bus. Delivery is asynchronous (never inside the publisher's call stack)
// and each consumer group gets every event once, mirroring Kafka semantics for
// a single process.
export class MemoryBus {
  constructor(log) {
    this.kind = "memory";
    this.log = log;
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    this.pending = new Set();
  }

  async connect() {}

  async publish(topic, event) {
    const p = new Promise((resolve) => setImmediate(() => { this.emitter.emit(topic, event); resolve(); }));
    this.pending.add(p);
    p.finally(() => this.pending.delete(p));
  }

  async subscribe(topic, groupId, handler, { retries = 2 } = {}) {
    this.emitter.on(topic, async (event) => {
      const task = (async () => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            await handler(event);
            return;
          } catch (err) {
            this.log.error({ err, topic, groupId, attempt, eventId: event.eventId }, "Event handler failed");
          }
        }
      })();
      this.pending.add(task);
      task.finally(() => this.pending.delete(task));
    });
  }

  // Test helper: wait until every published event and handler has settled.
  async drain() {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  async disconnect() { this.emitter.removeAllListeners(); }
}
