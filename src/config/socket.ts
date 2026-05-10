import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HTTPServer, allowedOrigins: string[]): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
    path: "/socket.io",
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    const eventId = socket.handshake.query.eventId as string | undefined;
    if (eventId) socket.join(`event:${eventId}`);
    socket.on("join-event", (id: string) => {
      if (typeof id === "string") socket.join(`event:${id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}
