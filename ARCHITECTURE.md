# MockBank Architecture & System Design

This document provides a detailed technical overview of MockBank, highlighting its component design, technology choices, and layered architecture. 

---

## 🏗 System Architecture Overview

MockBank is built as a **Local-First Single Page Application (SPA)**. Instead of relying on a traditional client-server architecture, it heavily leverages the browser's native capabilities (IndexedDB, File System Access API, BroadcastChannel API) to create a robust, backend-less system. 

The architecture is explicitly decoupled into layers:
1. **Routing Layer**: URL parameter-based window resolution.
2. **Presentation Layer**: UI Components, Forms, and complex interactive windows.
3. **Domain/Business Logic Layer**: State management, filtering rules, and cross-window messaging.
4. **Persistence/Data Layer**: Local IndexedDB wrapper and File System handles.

---

## 🛠 Tech Stack & Rationale

| Technology | Purpose | Rationale |
| :--- | :--- | :--- |
| **React 18** | UI Framework | Component-driven ecosystem perfect for complex interactive forms and viewers. |
| **Vite** | Build Tool | Extremely fast HMR and optimized production builds. |
| **TypeScript** | Type Safety | Enforces strict data schemas across the persistence layer and UI components. |
| **Dexie.js** | Database / ORM | Minimalistic, promise-based wrapper around IndexedDB with excellent React hook integration (`useLiveQuery`). |
| **Zustand** | State Management | Lightweight global state for UI configurations without the boilerplate of Redux. |
| **Tailwind CSS** | Styling | Rapid UI prototyping with utility classes and a unified design system. |
| **Lucide React** | Icons | Clean, consistent, and lightweight vector icons. |
| **React Markdown / KaTeX** | Content Rendering | Safely renders user-generated Markdown and complex math formulas. |

---

## 🧩 Component Deep-Dive

### 1. Frontend/Presentation Layer
The UI is divided into three distinct top-level "Windows", orchestrated by `App.tsx`:
* **Hub (`Hub.tsx`)**: The central dashboard managing overall project states, image folder configuration, and high-level statistics.
* **Editor (`EditorWindow.tsx`)**: A focused workspace for writing questions. Includes a sidebar for quick navigation and a main editing form capable of rich text and metadata inputs.
* **Viewer (`ViewerWindow.tsx`)**: A robust querying interface. Supports "strip" and "grid" layouts for visualizing the question bank. Includes a complex sidebar (`FilterPanel`) to refine questions by tags, difficulty, status, and text search.

### 2. Backend/Routing Layer (Client-Side)
Because MockBank is purely client-side, the "backend" routing is managed via lightweight URL parameters:
* `?window=editor`: Mounts the Editor.
* `?window=viewer`: Mounts the Viewer.
* No param: Mounts the Hub.

**Cross-Window Communication**:
Rather than relying on a server via WebSockets, MockBank uses the browser's `BroadcastChannel` API (wrapped in `useBroadcast.ts`). When a user edits a question in the Editor, a `question:saved` event is broadcasted, allowing the Viewer to instantly react. Navigation commands (e.g., clicking "Open in Editor" from the Viewer) also fire `navigate:question` events to change the active state in the Editor window.

### 3. Domain/Business Logic Layer
This layer sits between the UI and the DB. It resides primarily within custom hooks and utility files:
* **`useFilter.ts`**: The core querying engine. It takes the raw array of questions from the database and runs them through a multi-pass filtering pipeline (project ID -> search text -> difficulty/status -> tag intersection/union -> dynamic metadata fields).
* **Tag Resolution**: Since tags can belong globally or specifically to a project, `resolveQuestion()` dynamically computes the `effectiveTags` and `effectiveMetadata` inherited from the project layer.
* **Image Management Engine**: The `useImageStore.ts` hook interfaces with the Native File System Access API. It handles directory handle requests, permission checks, and finding/deleting orphaned image files.

### 4. Persistence/Data Layer
Data persistence is handled entirely via IndexedDB utilizing **Dexie.js** (`db/schema.ts`).
* **Schema Design**:
  * `questions`: Primary table holding JSON content, arrays of tag IDs, and statuses.
  * `projects`: Grouping mechanism for questions.
  * `tags`: Normalised tag dictionary.
  * `images`: Tracks image attachments added to the local file system.
  * `settings`: Key-Value store tracking user preferences (e.g., the persisted directory handle for the image store).
* **Reactivity**: Dexie's `useLiveQuery` hook is used heavily throughout the UI. The presentation components don't fetch data; they subscribe to queries. When a record is updated in IndexedDB, the React components automatically re-render with the latest data, creating a seamless reactive data flow.

---

## 🔄 Data Flow & Communication Lifecycle

**Example: Editing a Question and Viewing the Update**

1. **User Interaction**: The user changes the status of a question to "Correct" inside `EditorWindow.tsx`.
2. **Domain Action**: The UI calls `saveQuestion(question)` from the business layer (`db/questions.ts`).
3. **Persistence (Write)**: Dexie issues a `.put()` command to IndexedDB.
4. **Broadcast**: Upon successful save, the Editor dispatches a `question:saved` message over the `BroadcastChannel`.
5. **Persistence (Read)**: `useLiveQuery` hooks in both the Editor and Viewer detect the IndexedDB mutation and fetch the updated dataset.
6. **Filtering**: In the Viewer, the `useFilter` hook immediately re-runs the pipeline. If the user was filtering only by "Wrong", the question is dynamically removed from the active view.
7. **UI Update**: React reconciles the DOM, immediately reflecting the status change across all open windows.
