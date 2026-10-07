// Push a server event to every socket of one user. Best-effort: in a worker
// process without a Socket.IO server this is a no-op and clients fall back to
// polling the REST endpoint.
let io = null;
export const setIo = (server) => { io = server; };
export const getIo = () => io;
export const userRoom = (userId) => `user:${userId}`;
export function notifyUser(userId, event, payload) {
  io?.to(userRoom(String(userId))).emit(event, payload);
}
