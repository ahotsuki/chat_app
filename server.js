// Global requires
require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");

// Server requires
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Helper requires
const messageFormat = require("./utils/message");
const DB = require("./db/db");
const externalApi = require("./db/external");
const { response } = require("express");

app.use(express.json());

// Set static folder
app.use(express.static(path.join(__dirname, "public")));
app.use(
  express.static(path.join(__dirname, "node_modules", "materialize-css"))
);

// Username of auto-generated messages
const ADMIN = "Admin";

// Collections
// let USERS = []; // { id, name, room }
// let ROOMS = [
//   {
//     name: "Public",
//     password: "",
//     public: true,
//     users: [],
//   },
//   {
//     name: "Educational",
//     password: "",
//     public: true,
//     users: [],
//   },
//   {
//     name: "Gaming",
//     password: "",
//     public: true,
//     users: [],
//   },
// ]; // { name, password, public:(true or false), users: [{id}]}
// let MESSAGES = []; // {room, messages:[{ messageFormat }]}

// Api endpoints
app.get("/api/rooms", (req, res) => {
  const ROOMS = DB.getRooms();
  let list = [];
  ROOMS.forEach((element) => {
    list.push({
      name: element.name,
      userCount: element.users.length,
      public: element.public ? true : false,
    });
  });
  res.send(list);
});
app.get("/api/rooms/:name", (req, res) => {
  const ROOMS = DB.getRooms();
  const room = req.params.name;
  const password = req.headers.password;
  const index = ROOMS.findIndex((item) => item.name === room);
  if (ROOMS[index].password === password)
    return res.send({ verified: true, room });
  res.send({ verified: false, room });
});
app.post("/api/rooms", (req, res) => {
  const room = req.body;
  const format = {
    name: room.name,
    password: room.password,
    users: [],
  };
  DB.createRoom(format, (result) => res.send(result));
});

// SocketIO connection
io.on("connection", (socket) => {
  //For room page
  socket.on("refresh", () => {
    socket.join("__refresh_room");
  });

  //
  //
  //
  // When a user joins a room
  socket.on("joinRoom", (user) => {
    const currentUser = { id: socket.id, name: user.username, room: user.room };

    // Saves socket id and username to the USERS collection
    DB.createUser(currentUser);

    // Saves to roomname with user socket id to the ROOM collection
    DB.updateRoomAdd(currentUser);

    // Joins the user to the room
    socket.join(user.room);

    // Displays the previous messages if room has already existed before the user joins
    DB.getMessage(currentUser.room, (result) => {
      result.messages.forEach((element) => {
        socket.emit("message", element);
      });
    });

    // Welcome message
    socket.emit(
      "message",
      messageFormat(
        ADMIN,
        `Welcome <span class="orange-text">${user.username}</span>! Happy chatting!`
      )
    );
    socket.emit(
      "message",
      messageFormat(
        "Chat Bot",
        `Enter <span class="orange-text">"/"</span> for a list of commands.`
      )
    );

    // Broadcast to other users when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        messageFormat(
          ADMIN,
          `<span class="orange-text">${user.username}</span> has joined the chat`
        )
      );

    // Broadcast configurations to everyone
    const USERS = DB.getUsers();
    const ROOMS = DB.getRooms();
    const roomIndex = ROOMS.findIndex((room) => room.name === user.room);
    let userList = [];
    ROOMS[roomIndex].users.forEach((element) => {
      const index = USERS.findIndex((item) => item.id === element);
      userList.push(USERS[index].name);
    });
    io.to(user.room).emit("configurations", {
      name: user.room,
      users: userList,
    });
    socket.broadcast.to("__refresh_room").emit("refresh");
  });

  //
  //
  //
  // Listen to chat messages
  socket.on("chat-message", (message) => {
    const user = DB.getUser(socket.id);
    const formattedMessage = messageFormat(user.name, message);

    // Sends the message to self and everyone
    DB.createMessage(user.room, formattedMessage, (message) => {
      socket.emit("message", { ...message, username: "You" });
      socket.broadcast.to(user.room).emit("message", message);
    });
  });

  //
  //
  //
  // Listens to command calls
  socket.on("search-gifs", (query) => {
    externalApi.searchGifs(query, ({ data }) => {
      socket.emit("search-gifs", data);
    });
  });
  socket.on("search-stickers", (query) => {
    externalApi.searchStickers(query, ({ data }) => {
      socket.emit("search-stickers", data);
    });
  });
  socket.on("get-all-emojis", () => {
    externalApi.getAllEmojis((data) => socket.emit("get-all-emojis", data));
  });
  socket.on("search-emojis", (query) => {
    externalApi.searchEmojis(query, (data) =>
      socket.emit("search-emojis", data)
    );
  });

  //
  //
  //
  // When a user leaves a room
  socket.on("disconnect", () => {
    // Removes user to USERS collection
    const user = DB.deleteUser(socket.id);
    if (!user) return;

    DB.updateRoomDelete(user, (room) => {
      if (room.users.length === 0) {
        if (!room.public) {
          DB.deleteRoom(room);
        }
        DB.deleteMessageCollection(room.name);
      }

      socket.broadcast
        .to(user.room)
        .emit(
          "message",
          messageFormat(ADMIN, `${user.name} has left the chat.`)
        );

      // Broadcast configurations to everyone
      let userList = [];
      const USERS = DB.getUsers();
      room.users.forEach((element) => {
        const index = USERS.findIndex((item) => item.id === element);
        userList.push(USERS[index].name);
      });
      io.to(user.room).emit("configurations", {
        name: user.room,
        users: userList,
      });
      socket.broadcast.to("__refresh_room").emit("refresh");
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}...`));
