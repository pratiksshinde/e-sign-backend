# eSign Workflow Backend (NestJS)

A backend API for uploading PDF documents, managing signature fields, and running a **sequential e-sign workflow** with [DocuSeal](https://www.docuseal.com/).

Built for the Backend Developer Assignment – eSign Workflow Application.

---

## Features

- Upload PDF documents (stored locally in `uploads/`)
- Save document metadata in PostgreSQL
- Add signature tags (coordinates) for Role 2 and Role 3
- Create and submit signing workflows via DocuSeal API
- Sequential signing: Role 2 signs first → Role 3 email is updated → Role 3 signs
- Webhook handler for DocuSeal events
- Audit trail for every workflow action
- Swagger API docs at `/api/docs`

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| NestJS | Backend framework |
| TypeScript | Language |
| PostgreSQL | Database |
| Sequelize | ORM |
| DocuSeal API | e-Signature provider |
| Swagger | API documentation |

---

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or cloud like [Neon](https://neon.tech))
- DocuSeal account + API key from [console.docuseal.com](https://console.docuseal.com)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

```env
PORT=3000
DB_URL=postgresql://username:password@localhost:5432/esign_db
DB_SSL=false
DOCUSEAL_API_KEY=your_docuseal_api_key_here
DOCUSEAL_API_URL=https://api.docuseal.com
```

### 3. Start the server

```bash
# Development (auto-reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Open Swagger UI: **http://localhost:3000/api/docs**

---

## API Endpoints

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | `POST` | `/documents/upload` | Upload a PDF document |
| 2 | `POST` | `/workflows` | Create a workflow |
| 3 | `POST` | `/documents/:documentId/signature-tags` | Add signature tag |
| 4 | `POST` | `/workflows/:id/submit` | Submit for signing |
| 5 | `GET` | `/workflows/:id/status` | Get workflow status + audit trail |
| 6 | `PATCH` | `/workflows/:id/role3-email` | Update Role 3 email |
| 7 | `GET` | `/documents/:id` | Get document details |
| 8 | `GET` | `/workflows/:id/signed-document` | Download signed PDF |

**Extra endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/documents/:id/preview` | Preview PDF in browser |
| `GET` | `/documents/:id/download` | Download original PDF |
| `GET` | `/documents/:documentId/signature-tags` | List signature tags |
| `POST` | `/webhooks/docuseal` | DocuSeal webhook receiver |

---

## Complete Workflow Demo (Step by Step)

### Step 1 – Role 1 uploads document

```http
POST /documents/upload
Content-Type: multipart/form-data

uploadedByEmail: role1@example.com
file: [your PDF file]
```

Response gives you a `document.id` (e.g. `1`).

### Step 2 – Role 1 adds signature tags

```http
POST /documents/1/signature-tags
Content-Type: application/json

{
  "role": "ROLE_2",
  "pageNumber": 1,
  "xPosition": 100,
  "yPosition": 600,
  "width": 150,
  "height": 50,
  "fieldType": "SIGNATURE"
}
```

Add at least one tag for `ROLE_2` and one for `ROLE_3`.

### Step 3 – Role 1 creates workflow

```http
POST /workflows
Content-Type: application/json

{
  "documentId": 1,
  "role1Email": "role1@example.com",
  "role2Email": "role2.placeholder@example.com"
}
```

Note: Role 3 email is **not** provided yet (placeholder is used internally).

### Step 4 – Submit for signing

```http
POST /workflows/1/submit
```

This sends the document to DocuSeal. Role 2 receives a signing email.

Status becomes: **PENDING_ROLE_2_SIGNATURE**

### Step 5 – Role 2 signs via DocuSeal

Role 2 opens the signing link from DocuSeal email and signs the document.

When Role 2 completes, DocuSeal sends a `form.completed` webhook to your server.

> **Webhook setup:** In DocuSeal → Settings → API → Webhooks, add:
> `https://your-public-url/webhooks/docuseal`
> Enable events: `form.completed`, `submission.completed`

For local testing, use [ngrok](https://ngrok.com): `ngrok http 3000`

### Step 6 – Update Role 3 email (after Role 2 signs)

```http
PATCH /workflows/1/role3-email
Content-Type: application/json

{
  "role3Email": "role3@example.com"
}
```

This replaces the placeholder email and sends the signing request to Role 3.

Status becomes: **PENDING_ROLE_3_SIGNATURE**

### Step 7 – Role 3 signs via DocuSeal

Role 3 receives email, signs the document. Workflow status becomes **COMPLETED**.

### Step 8 – Download signed document

```http
GET /workflows/1/signed-document
```

---

## Workflow Status Values

| Status | Meaning |
|--------|---------|
| `DRAFT` | Document uploaded, workflow not submitted |
| `PENDING_ROLE_2_SIGNATURE` | Waiting for Role 2 to sign |
| `PENDING_ROLE_3_SIGNATURE` | Role 3 email updated, waiting for Role 3 |
| `COMPLETED` | All parties signed |
| `FAILED` | Something went wrong |

---

## DocuSeal Assumptions & Limitations

1. **Placeholder email for Role 3:** During submission, Role 3 is created with `role3.placeholder@pending.local`. DocuSeal requires an email for every submitter at creation time. We update it to the real email after Role 2 signs.

2. **Sequential signing:** DocuSeal `order: "preserved"` ensures Role 3 does not receive the document until Role 2 completes signing.

3. **Field coordinates:** Signature tag x/y/width/height values are sent to DocuSeal as pixel coordinates on the PDF page.

4. **Webhooks required:** For automatic status updates when signers complete, configure DocuSeal webhooks. Without webhooks, you must manually track signing progress via DocuSeal dashboard.

5. **Role 1 is the initiator:** Role 1 uploads and configures the workflow but does not sign. Only Role 2 and Role 3 are signers.

---

## Project Structure

```
src/
├── main.ts                  # App entry point + Swagger setup
├── app.module.ts            # Root module
├── common/
│   ├── enums.ts             # Status, roles, field types
│   └── constants.ts         # DocuSeal role name mapping
├── documents/               # Document upload & tags
├── workflows/               # Workflow orchestration
├── docuseal/                # DocuSeal API integration
└── webhooks/                # DocuSeal webhook handler
```

---

## Running Tests

```bash
npm test
```

---

## 🎓 Interview Preparation & Learning NestJS

If you are a beginner to NestJS or preparing for an interview based on this project, please read:
**[NESTJS_TUTORIAL.md](./NESTJS_TUTORIAL.md)** 

This guide explains the entire project flow, NestJS concepts (Modules, Controllers, Services), the DocuSeal sequential signing logic, and provides **frequently asked interview questions with answers**.
