// Global requires
require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const QS = require("query-string");

// Server requires
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Helper requires
const messageFormat = require("./utils/message");

// Set static folder
app.use(express.static(path.join(__dirname, "public")));
app.use(
  express.static(path.join(__dirname, "node_modules", "materialize-css"))
);

// Username of auto-generated messages
const ADMIN = "Admin";

// Collections
let USERS = []; // { id, name, room }
let ROOMS = []; // { name, users: [{id}]}
let MESSAGES = []; // {room, messages:[{ messageFormat }]}

// Test endpoints
app.get("/api/users", (req, res) => res.send(USERS));
app.get("/api/rooms", (req, res) => res.send(ROOMS));
app.get("/api/messages", (req, res) => res.send(MESSAGES));

// SocketIO connection
io.on("connection", (socket) => {
  // When a user joins a room
  socket.on("joinRoom", (url) => {
    const user = QS.parse(url);

    // Saves socket id and username to the USERS collection
    USERS.push({
      id: socket.id,
      name: user.username,
      room: user.room,
    });

    // Saves roomname with users' socket ids to the ROOM collection
    let roomIndex = ROOMS.findIndex((room) => room.name === user.room);
    if (roomIndex === -1) {
      ROOMS.push({
        name: user.room,
        users: [socket.id],
      });
    } else {
      ROOMS[roomIndex].users.push(socket.id);
    }

    // Joins the user to the room
    socket.join(user.room);

    // Displays the previous messages if room has already existed before the user joins
    const messageIndex = MESSAGES.findIndex((item) => item.room === user.room);
    if (messageIndex !== -1) {
      MESSAGES[messageIndex].messages.forEach((element) => {
        socket.emit("message", element);
      });
    }

    // Welcome message
    socket.emit(
      "message",
      messageFormat(ADMIN, `Welcome ${user.username}! Happy chatting!`)
    );

    // Broadcast to other users when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        messageFormat(ADMIN, `${user.username} has joined the chat`)
      );

    // Broadcast configurations to everyone
    roomIndex = ROOMS.findIndex((room) => room.name === user.room);
    let userList = [];
    ROOMS[roomIndex].users.forEach((element) => {
      const index = USERS.findIndex((item) => item.id === element);
      userList.push(USERS[index].name);
    });
    io.to(user.room).emit("configurations", {
      name: ROOMS[roomIndex].name,
      users: userList,
    });
  });

  // Listen to chat messages
  socket.on("chat-message", (message) => {
    const index = USERS.findIndex((item) => item.id === socket.id);
    const user = USERS[index];

    const formattedMessage = messageFormat(user.name, message);

    // Checks if the room has recorded messages
    const messageIndex = MESSAGES.findIndex((item) => item.room === user.room);
    if (messageIndex === -1) {
      MESSAGES.push({
        room: user.room,
        messages: [formattedMessage],
      });
    } else {
      MESSAGES[messageIndex].messages.push(formattedMessage);
    }

    socket.emit("message", { ...formattedMessage, username: "You" });
    socket.broadcast.to(user.room).emit("message", formattedMessage);
  });

  // When a user leaves a room
  socket.on("disconnect", () => {
    const userIndex = USERS.findIndex((item) => item.id === socket.id);

    if (userIndex === -1) return;

    const roomIndex = ROOMS.findIndex(
      (item) => item.name === USERS[userIndex].room
    );

    const user = USERS.splice(userIndex, 1)[0];

    if (ROOMS[roomIndex].users.length > 1) {
      const index = ROOMS[roomIndex].users.findIndex(
        (item) => item === user.id
      );
      ROOMS[roomIndex].users.splice(index, 1);
    } else {
      const r = ROOMS.splice(roomIndex, 1);
      const index = MESSAGES.findIndex((item) => item.room === r.name);
      MESSAGES.splice(index, 1);
    }

    socket.broadcast
      .to(user.room)
      .emit("message", messageFormat(ADMIN, `${user.name} has left the chat.`));

    // Broadcast configurations to everyone
    if (!ROOMS[roomIndex]) return;
    let userList = [];
    ROOMS[roomIndex].users.forEach((element) => {
      const index = USERS.findIndex((item) => item.id === element);
      userList.push(USERS[index].name);
    });
    io.to(user.room).emit("configurations", {
      name: ROOMS[roomIndex].name,
      users: userList,
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}...`));