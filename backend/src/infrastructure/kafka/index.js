import { env } from "../../config/env.js";
import { childLogger } from "../logger/index.js";
import { createEvent } from "../../shared/events.js";
import { MemoryBus } from "./memoryBus.js";
import { KafkaBus } from "./kafkaBus.js";

const log = childLogger("events");
let bus;

export async function connectBus() {
  if (bus) return bus;
  if (env.KAFKA_BROKERS.length) {
    bus = new KafkaBus({ brokers: env.KAFKA_BROKERS, clientId: env.KAFKA_CLIENT_ID, log });
    await bus.connect();
    log.info({ brokers: env.KAFKA_BROKERS }, "Connected to Kafka");
  } else {
    bus = new MemoryBus(log);
    log.info("KAFKA_BROKERS not set: using in-process event bus");
  }
  return bus;
}

export const getBus = () => bus || (bus = new MemoryBus(log));

// Publishing never fails the caller's request: the durable state is already in
// MongoDB, and every consumer can be re-triggered (e.g. POST /analyze).
export async function publish(topic, eventType, payload, key) {
  const event = createEvent(eventType, payload);
  try {
    await getBus().publish(topic, event, key);
  } catch (err) {
    log.error({ err, topic, eventType }, "Failed to publish event");
  }
  return event;
}

export const subscribe = (topic, groupId, handler, opts) => getBus().subscribe(topic, groupId, handler, opts);

export async function closeBus() {
  if (bus) await bus.disconnect();
  bus = undefined;
}
