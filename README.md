# MockBank 📚
**Your Personal Local-First Mock Test Question Bank**

---

## 🧐 The Problem & The Solution

**The Problem**: 
Managing personal collections of mock test questions—especially those containing complex mathematical formulas, rich text formatting, and images—can be cumbersome. Traditional note-taking apps lack specialized features like difficulty tracking, status updates, and advanced filtering. On the other hand, robust question bank software is usually cloud-based, subscription-locked, or requires complicated backend setups. 

**The Solution**: 
**MockBank** is a fully local, offline-first web application designed specifically for curating and managing mock tests. It uses modern browser APIs (IndexedDB, File System Access API) to store all your questions, metadata, and images securely on your own machine. With a decoupled multi-window interface, you can edit questions on one screen while viewing your entire filtered collection on another, seamlessly synced in real-time.

---

## ✨ Key Features

* **Multi-Window Synchronization**: Open the Hub, Editor, and Viewer in separate browser windows. They instantly communicate using Broadcast Channels—saving a question in the editor immediately updates the viewer.
* **Rich Markdown & Math Support**: Write complex equations effortlessly using the integrated Markdown and KaTeX rendering engine.
* **Local Image Storage**: Safely store question images locally on your computer. MockBank tracks orphaned images and cleans up your file system automatically.
* **Advanced Filtering & Tagging**: Organize questions into "Projects" and tag them. Use the powerful Viewer filter panel to search by difficulty, status, tags, and custom metadata fields.
* **Offline & Privacy First**: No backend server, no cloud accounts. All your data lives locally in your browser's IndexedDB.
* **Export & Import**: Backup your entire question bank or share specific projects using built-in JSON export/import features.

---

## 🚀 Quick Start Guide

MockBank requires Node.js and `npm` installed on your machine.

**1. Clone the repository**
```bash
git clone <repository-url>
cd question-bank
```

**2. Install Dependencies**
```bash
npm install
```

**3. Run the Development Server**
```bash
npm run dev
```

**4. Open in Browser**
Navigate to `http://localhost:5173` (or the port Vite provides) in your web browser. 

* **First steps:** 
  1. Click **Choose Folder** in the Image Store setup to grant local folder access.
  2. Create a **New Project**.
  3. Click **New Question** to launch the Editor and start building your bank!
