// Get elements in DOM
const chatForm = document.getElementById("chat-form");
const chatMessages = document.querySelector(".chat-messages");
const roomName = document.getElementById("room-name");
const userList = document.getElementById("users");
const graphics = document.getElementById("graphics-container");

// Initialize socket for client
const socket = io();

socket.emit("joinRoom", {
  username: window.sessionStorage.getItem("username"),
  room: window.sessionStorage.getItem("room"),
});

socket.on("message", (message) => {
  outputMessage(message);

  // Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Configure room and users to DOM
socket.on("configurations", ({ name, users }) => {
  roomName.innerText = name;

  userList.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.innerText = user;
    userList.appendChild(li);
  });
});

// Message submit
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // Get message text
  let msg = e.target.elements.msg.value;

  msg = msg.trim();

  if (!msg) {
    return false;
  }

  if (msg === "/") {
    const commands = `
      <span class="orange-text">/gifs</span> <span class="blue-text text-lighten-4">[your search keyword here]</span> <br>
        - Gives you a list of gifs. <br>
      <span class="orange-text">/stickers</span> <span class="blue-text text-lighten-4">[your search keyword here]</span> <br>
      - Gives you a list of stickers. <br>
      <span class="orange-text">/emojis</span> <br>
      - Gives you a list of emojis. <br>
      <span class="orange-text">/emojis</span> <span class="blue-text text-lighten-4">[your search keyword here]</span> <br>
      - Search a list of emojis with your keyword. <br>
    `;

    e.target.elements.msg.value = "";
    e.target.elements.msg.focus();
    return outputMessage({
      username: "Chat Bot",
      time: "System time",
      content: commands,
    });
  }

  if (msg.startsWith("/")) {
    const msgArr = msg.split(" ");
    const cmd = msgArr.shift();
    const query = msgArr.join(" ").trim();
    e.target.elements.msg.value = "";
    if (cmd === "/gifs") {
      graphics.classList.remove("no-display");
      loadContents();
      if (query === "") return noResult();
      socket.emit("search-gifs", query);
      return;
    } else if (cmd === "/stickers") {
      graphics.classList.remove("no-display");
      loadContents();
      if (query === "") return noResult();
      socket.emit("search-stickers", query);
      return;
    } else if (cmd === "/emojis") {
      graphics.classList.remove("no-display");
      loadContents();
      if (query === "") return socket.emit("get-all-emojis");
      socket.emit("search-emojis", query);
      return;
    } else {
      return outputMessage({
        username: "Chat Bot",
        time: "System time",
        content: `<span class="red-text">Error:</span> Command <span class="orange-text">"${cmd}"</span> not found.`,
      });
    }
  }

  // Emit message to server
  socket.emit("chat-message", msg);

  // Clear input
  e.target.elements.msg.value = "";
  e.target.elements.msg.focus();
});

// Display the list of searched gifs
socket.on("search-gifs", ({ data }) => {
  graphics.innerHTML = "";
  if (data.length > 0) {
    data.forEach((item) => outputGifs(item));
    return;
  }
  noResult();
});

// Display the list of searched stickers
socket.on("search-stickers", ({ data }) => {
  graphics.innerHTML = "";
  if (data.length > 0) {
    data.forEach((item) => outputStickers(item));
    return;
  }
  noResult();
});

// Display the list of all emojis
socket.on("get-all-emojis", (data) => {
  if (!data) return noResult();
  graphics.innerHTML = "";
  data.forEach((item) => {
    graphics.innerHTML += `<a onclick="displayEmoji(this)" class="btn-flat" id="${item.character}">${item.character}</a>`;
  });
});

// Display the list of searched emojis
socket.on("search-emojis", (data) => {
  if (!data) return noResult();
  graphics.innerHTML = "";
  data.forEach((item) => {
    graphics.innerHTML += `<a onclick="displayEmoji(this)" class="btn-flat" id="${item.character}">${item.character}</a>`;
  });
});

// Outputs emoji to chat box
function displayEmoji(e) {
  document.getElementById("msg").value += e.id;
}

// Manage the graphics div
document.addEventListener("click", (e) => {
  if (graphics !== e.target && !graphics.contains(e.target)) {
    graphics.classList.add("no-display");
    graphics.innerHTML = "";
  }
});

// Output message to DOM
function outputMessage(message) {
  const div = document.createElement("div");
  message.username === "You"
    ? div.setAttribute("class", "message teal darken-4")
    : div.setAttribute("class", "grey darken-3 message");
  const p = document.createElement("p");
  message.username === "You"
    ? p.setAttribute("class", "meta red-text text-lighten-3")
    : p.setAttribute("class", "meta deep-purple-text text-lighten-3");
  p.innerText = message.username;
  p.innerHTML += `<span class="${
    message.username === "You" ? "orange-text" : "teal-text text-lighten-2"
  }"> at ${message.time}</span>`;
  div.appendChild(p);
  const para = document.createElement("p");
  para.classList.add("text");
  para.innerHTML = message.content;
  div.appendChild(para);
  document.querySelector(".chat-messages").appendChild(div);
}

// Output Gifs to Dom
function outputGifs(gif) {
  const img = document.createElement("img");
  img.src = gif.images.downsized.url;
  img.setAttribute("alt", gif.title);
  img.setAttribute("class", "graphics-container-item");
  img.onclick = () => {
    const message = `<img src="${gif.images.downsized.url}" alt="${gif.title}" class="graphics-container-item" />`;
    socket.emit("chat-message", message);
    graphics.classList.add("no-display");
    graphics.innerHTML = "";
  };
  graphics.appendChild(img);
}

// Output Stickers to DOM
function outputStickers(sticker) {
  const div = document.createElement("div");
  div.setAttribute("style", "display:flex;flex-direction:column;");
  const btn = document.createElement("button");
  btn.setAttribute("class", "btn-flat btn-small");
  btn.setAttribute("id", `${sticker.title}`);
  btn.innerText = "Use Me!";

  btn.setAttribute("onclick", "useMe(this)");
  div.appendChild(btn);
  div.innerHTML += `<iframe src="${sticker.embed_url}" class="giphy-embed graphics-container-item"></iframe>`;
  graphics.appendChild(div);
}

function useMe(e) {
  const message = `<iframe src="${e.nextElementSibling.src}" class="giphy-embed graphics-container-item"></iframe>`;
  socket.emit("chat-message", message);
  graphics.classList.add("no-display");
  graphics.innerHTML = "";
}

// No command result
function noResult() {
  const element = `<span class="orange-text flow-text" style="margin:1em">No result found.</span>`;
  graphics.innerHTML = element;
}

// Preloader
function loadContents() {
  graphics.innerHTML = `
  <div class="preloader-wrapper big active">
      <div class="spinner-layer spinner-blue">
        <div class="circle-clipper left">
          <div class="circle"></div>
        </div><div class="gap-patch">
          <div class="circle"></div>
        </div><div class="circle-clipper right">
          <div class="circle"></div>
        </div>
      </div>
  `;
}
