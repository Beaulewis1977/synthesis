# UI Specification
**Version:** 1.0 (MVP - Simple & Functional)  
**Last Updated:** October 6, 2025

---

## 🎯 Design Philosophy

**MVP = Function Over Beauty**

- Simple, clean interface
- Focus on usability
- No animations or fancy effects
- Desktop-first (mobile Phase 2)
- Your beautiful mockups = Phase 2

---

## 📄 Pages

### 1. Dashboard (Home)
**Route:** `/`  
**Purpose:** List all collections

```
┌─────────────────────────────────────────────────────┐
│  Synthesis RAG                    [+ New Collection] │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Your Collections                                    │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │  Flutter & Dart  │  │  Supabase Stack  │        │
│  │                  │  │                  │        │
│  │  📄 45 docs      │  │  📄 32 docs      │        │
│  │  Updated 2d ago  │  │  Updated 5h ago  │        │
│  │                  │  │                  │        │
│  │  [View] [Chat]   │  │  [View] [Chat]   │        │
│  └──────────────────┘  └──────────────────┘        │
│                                                      │
│  ┌──────────────────┐                               │
│  │  Personal Notes  │                               │
│  │                  │                               │
│  │  📄 12 docs      │                               │
│  │  Updated 1w ago  │                               │
│  │                  │                               │
│  │  [View] [Chat]   │                               │
│  └──────────────────┘                               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Components:**
- Header with app name
- "New Collection" button (top right)
- Grid of collection cards
- Each card shows: name, doc count, last updated, actions

---

### 2. Collection View
**Route:** `/collections/:id`  
**Purpose:** List documents in a collection

```
┌─────────────────────────────────────────────────────┐
│  ← Back    Flutter & Dart               [Upload]    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  45 Documents                          [Chat →]     │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ 📄 Flutter Widget Basics              ✓ Ready  │ │
│  │    PDF • 1.2 MB • 52 chunks • 2 days ago       │ │
│  │    [Delete]                                     │ │
│  ├────────────────────────────────────────────────┤ │
│  │ 📄 Dart Language Tour                 ⏳ Processing│
│  │    DOCX • 850 KB • Processing... 65%           │ │
│  ├────────────────────────────────────────────────┤ │
│  │ 📄 State Management Guide             ✓ Ready  │ │
│  │    MD • 45 KB • 12 chunks • 5 days ago         │ │
│  │    [Delete]                                     │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Components:**
- Back button
- Collection name
- Upload button
- Chat button (navigates to chat)
- Document list (scrollable)
- Each doc shows: name, type, size, status, chunks, age
- Delete button per doc

---

### 3. Upload Page
**Route:** `/collections/:id/upload`  
**Purpose:** Upload documents

```
┌─────────────────────────────────────────────────────┐
│  ← Back to Collection                                │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Upload Documents to: Flutter & Dart                │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │                                                 │ │
│  │         📁 Drag & Drop Files Here              │ │
│  │              or click to browse                 │ │
│  │                                                 │ │
│  │      Supported: PDF, DOCX, Markdown             │ │
│  │      Max size: 50 MB per file                   │ │
│  │                                                 │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Files Selected (2):                                │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ flutter-guide.pdf         1.2 MB    [Remove]   │ │
│  │ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ 45%                       │ │
│  ├────────────────────────────────────────────────┤ │
│  │ state-management.md       45 KB     [Remove]   │ │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100% ✓                    │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│                              [Cancel] [Upload All]  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Components:**
- Back button
- Collection name
- Drag & drop zone
- File browser button
- Selected files list with progress bars
- Remove button per file
- Upload all button

---

### 4. Chat Interface
**Route:** `/chat/:collectionId`  
**Purpose:** Chat with agent about docs

```
┌─────────────────────────────────────────────────────┐
│  ← Collections    Chatting with: Flutter & Dart     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │                                                 │ │
│  │  You: How do I manage state in Flutter?        │ │
│  │                                                 │ │
│  │  Agent: 🤔 Searching documentation...          │ │
│  │         🔧 Tool: search_rag                     │ │
│  │                                                 │ │
│  │  Agent: Flutter offers several state           │ │
│  │         management solutions:                   │ │
│  │                                                 │ │
│  │         1. setState() - For simple local state │ │
│  │         2. Provider - For app-wide state       │ │
│  │         3. Riverpod - Modern alternative...    │ │
│  │                                                 │ │
│  │         📚 Sources:                             │ │
│  │         • State Management Guide, p. 12        │ │
│  │         • Flutter Widget Basics, p. 45         │ │
│  │                                                 │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ Type your message...                 [Send →]  │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Components:**
- Back to collections
- Collection name in header
- Chat history (scrollable)
- User messages (right-aligned)
- Agent messages (left-aligned)
- Tool call indicators (show what agent is doing)
- Citations (clickable links)
- Message input field
- Send button

---

### 5. New Collection Modal
**Trigger:** Click "New Collection" button  
**Purpose:** Create new collection

```
┌─────────────────────────────────────────────────────┐
│  Create New Collection                        [×]   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Collection Name *                                  │
│  ┌────────────────────────────────────────────────┐ │
│  │ My Project Documentation                        │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Description (optional)                             │
│  ┌────────────────────────────────────────────────┐ │
│  │ Technical docs for my Flutter app               │ │
│  │                                                 │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│                           [Cancel] [Create]         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 Design System

### Colors

```css
/* Light mode (MVP only) */
--bg-primary: #ffffff;
--bg-secondary: #f5f5f5;
--bg-hover: #e8e8e8;
--text-primary: #1a1a1a;
--text-secondary: #666666;
--border: #e0e0e0;
--accent: #3b82f6;  /* Blue for buttons */
--success: #10b981;
--warning: #f59e0b;
--error: #ef4444;
```

### Typography

```css
--font-family: system-ui, -apple-system, sans-serif;
--font-size-sm: 14px;
--font-size-base: 16px;
--font-size-lg: 18px;
--font-size-xl: 24px;
```

### Spacing

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
```

---

## 🧩 Component Library

### Button

```tsx
<button className="btn btn-primary">
  Upload Documents
</button>

// Variants: btn-primary, btn-secondary, btn-danger
// Sizes: btn-sm, btn-md, btn-lg
```

### Card

```tsx
<div className="card">
  <h3>Collection Name</h3>
  <p>45 documents</p>
</div>
```

### Input

```tsx
<input 
  type="text" 
  className="input" 
  placeholder="Search..."
/>
```

### Modal

```tsx
<dialog className="modal">
  <div className="modal-content">
    <h2>Modal Title</h2>
    {/* Content */}
  </div>
</dialog>
```

---

## 📱 Component Specifications

### CollectionCard

**Props:**
```typescript
interface CollectionCardProps {
  id: string;
  name: string;
  description?: string;
  docCount: number;
  updatedAt: Date;
  onView: () => void;
  onChat: () => void;
}
```

**File:** `apps/web/src/components/CollectionCard.tsx`

```tsx
export function CollectionCard({ 
  name, 
  docCount, 
  updatedAt, 
  onView, 
  onChat 
}: CollectionCardProps) {
  return (
    <div className="card">
      <h3>{name}</h3>
      <p>📄 {docCount} docs</p>
      <p className="text-sm text-secondary">
        Updated {formatRelativeTime(updatedAt)}
      </p>
      <div className="card-actions">
        <button onClick={onView}>View</button>
        <button onClick={onChat} className="btn-primary">Chat</button>
      </div>
    </div>
  );
}
```

---

### DocumentList

**Props:**
```typescript
interface Document {
  id: string;
  title: string;
  contentType: string;
  fileSize: number;
  status: 'pending' | 'complete' | 'error';
  chunkCount?: number;
  createdAt: Date;
}

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
}
```

**File:** `apps/web/src/components/DocumentList.tsx`

```tsx
export function DocumentList({ documents, onDelete }: DocumentListProps) {
  return (
    <div className="document-list">
      {documents.map(doc => (
        <DocumentItem 
          key={doc.id} 
          document={doc} 
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
```

---

### ChatMessage

**Props:**
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  citations?: Citation[];
}

interface ChatMessageProps {
  message: Message;
}
```

**File:** `apps/web/src/components/ChatMessage.tsx`

```tsx
export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`message message-${message.role}`}>
      <div className="message-content">
        {message.content}
      </div>
      
      {message.toolCalls && (
        <div className="tool-calls">
          {message.toolCalls.map(call => (
            <span key={call.id} className="tool-badge">
              🔧 {call.tool}
            </span>
          ))}
        </div>
      )}
      
      {message.citations && message.citations.length > 0 && (
        <div className="citations">
          <p className="text-sm">📚 Sources:</p>
          {message.citations.map((cite, i) => (
            <div key={i} className="citation">
              • {cite.title}, p. {cite.page}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### UploadZone

**Props:**
```typescript
interface UploadZoneProps {
  collectionId: string;
  onUploadComplete: () => void;
}
```

**File:** `apps/web/src/components/UploadZone.tsx`

```tsx
export function UploadZone({ collectionId, onUploadComplete }: UploadZoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const newFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...newFiles]);
  };
  
  const handleUpload = async () => {
    setUploading(true);
    const formData = new FormData();
    formData.append('collection_id', collectionId);
    files.forEach(file => formData.append('files', file));
    
    await fetch('/api/ingest', {
      method: 'POST',
      body: formData,
    });
    
    setUploading(false);
    onUploadComplete();
  };
  
  return (
    <div 
      className="upload-zone"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <p>📁 Drag & Drop Files Here</p>
      <p className="text-sm">or click to browse</p>
      
      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, i) => (
            <FileItem key={i} file={file} />
          ))}
        </div>
      )}
      
      <button 
        onClick={handleUpload} 
        disabled={uploading || files.length === 0}
        className="btn-primary"
      >
        {uploading ? 'Uploading...' : 'Upload All'}
      </button>
    </div>
  );
}
```

---

## 🎯 State Management

### Collections State

```typescript
// apps/web/src/hooks/useCollections.ts
import { useQuery, useMutation } from '@tanstack/react-query';

export function useCollections() {
  const { data, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await fetch('/api/collections');
      return res.json();
    },
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
  });
  
  return {
    collections: data?.collections || [],
    isLoading,
    createCollection: createMutation.mutate,
  };
}
```

### Chat State

```typescript
// apps/web/src/hooks/useChat.ts
export function useChat(collectionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const sendMessage = async (content: string) => {
    const userMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        collection_id: collectionId,
        history: messages,
      }),
    });
    
    const data = await res.json();
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: data.message,
      toolCalls: data.tool_calls,
    }]);
    setIsLoading(false);
  };
  
  return { messages, sendMessage, isLoading };
}
```

---

## 📐 Layout

### App Shell

```tsx
// apps/web/src/App.tsx
export function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Synthesis RAG</h1>
        <nav>
          <Link to="/">Collections</Link>
        </nav>
      </header>
      
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/collections/:id" element={<CollectionView />} />
          <Route path="/collections/:id/upload" element={<UploadPage />} />
          <Route path="/chat/:collectionId" element={<ChatPage />} />
        </Routes>
      </main>
    </div>
  );
}
```

---

## ✅ UI Implementation Checklist

For agents building this:

- [ ] Install: react-router-dom, @tanstack/react-query, lucide-react
- [ ] Set up Tailwind CSS
- [ ] Create basic layout (App shell)
- [ ] Build Dashboard page
- [ ] Build Collection View page
- [ ] Build Upload page
- [ ] Build Chat page
- [ ] Create CollectionCard component
- [ ] Create DocumentList component
- [ ] Create ChatMessage component
- [ ] Create UploadZone component
- [ ] Add loading states
- [ ] Add error states
- [ ] Add empty states
- [ ] Test all flows

---

## 🚀 Phase 2: Beautiful UI

**After MVP works, use the provided mockups to:**
- Add animations
- Improve spacing and typography
- Add dark mode
- Add mobile responsive
- Add advanced features (search, filters, sorting)
- Add dashboard statistics
- Add settings page

**For now: Keep it simple and functional!**
