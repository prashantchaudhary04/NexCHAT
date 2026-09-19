# 💬 NexCHAT

### Connect. Chat. Share.

**NexCHAT** is a modern, full-stack real-time communication platform that allows users to connect using **unique usernames instead of phone numbers**. It provides a fast, secure, and responsive messaging experience with real-time conversations, media sharing, status updates, and more.

---

## ✨ Features

### 👤 Username-Based Identity
- Create an account using a unique username
- Discover and connect with users through their usernames
- No phone number required
- Manage your profile and contacts

### 💬 Real-Time Messaging
- Instant one-to-one messaging
- Real-time message delivery using Socket.io
- Online/offline user presence
- Message timestamps
- Smooth and responsive chat experience

### 📎 Media & File Sharing
Send different types of content directly through conversations:

- 🖼️ Images
- 🎥 Videos
- 📄 PDFs
- 📁 Other supported files
- ☁️ Cloud-based media storage

### 🟢 Status / Stories
- Share temporary status updates
- View other users' statuses
- Track status views
- Real-time status interactions
- Automatic status expiration

### 🔐 Authentication & Security
- Secure user authentication
- Protected routes
- Password hashing
- JWT-based authentication
- Server-side validation

### 🎨 Modern UI
- Clean and responsive interface
- Mobile-friendly design
- Modern chat layout
- Smooth interactions and animations
- Dark/light theme support

---

## 🛠️ Tech Stack

### Frontend

- React.js
- JavaScript
- Tailwind CSS
- React Router

### Backend

- Node.js
- Express.js
- Socket.io

### Database

- MongoDB
- Mongoose

### Authentication

- JWT
- bcrypt

### Media & Storage

- Cloudinary

### Development Tools

- Git
- GitHub
- VS Code
- Postman
- npm

---

## 🏗️ Architecture

```text
                    ┌──────────────────┐
                    │     NexCHAT      │
                    │     Frontend     │
                    │    React.js      │
                    └────────┬─────────┘
                             │
                    HTTP / WebSocket
                             │
                             ▼
                    ┌──────────────────┐
                    │     Backend      │
                    │ Node + Express   │
                    │    Socket.io     │
                    └───────┬───┬──────┘
                            │   │
                 ┌──────────┘   └──────────┐
                 ▼                         ▼
        ┌────────────────┐        ┌────────────────┐
        │    MongoDB     │        │   Cloudinary   │
        │ Users / Chats  │        │ Media / Files  │
        │ Messages       │        │                │
        └────────────────┘        └────────────────┘
