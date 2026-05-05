const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

wss.on("connection", (socket) => {
  console.log("Client Connected");

  socket.send("Welcome Client!");

  socket.on("message", (message) => {
    console.log("Received:", message.toString());
    socket.send(`Server Received: ${message}`);
  });

  socket.on("close", () => {
    console.log("Client Disconnected");
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});