// Get elements in DOM
const chatForm = document.getElementById("chat-form");
const chatMessages = document.querySelector(".chat-messages");
const roomName = document.getElementById("room-name");
const userList = document.getElementById("users");

// Initialize socket for client
const socket = io();

socket.emit("joinRoom", location.search);

socket.on("message", (message) => {
  outputMessage(message);

  // Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Configure room and users to DOM
socket.on("configurations", ({ name, users }) => {
  roomName.innerText = name;

  userList.innerHTML = "";
  console.log(users);
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

  // Emit message to server
  socket.emit("chat-message", msg);

  // Clear input
  e.target.elements.msg.value = "";
  e.target.elements.msg.focus();
});

// Output message to DOM
function outputMessage(message) {
  const div = document.createElement("div");
  div.classList.add("message");
  const p = document.createElement("p");
  p.classList.add("meta");
  p.innerText = message.username;
  p.innerHTML += `<span> at ${message.time}</span>`;
  div.appendChild(p);
  const para = document.createElement("p");
  para.classList.add("text");
  para.innerText = message.content;
  div.appendChild(para);
  document.querySelector(".chat-messages").appendChild(div);
}
