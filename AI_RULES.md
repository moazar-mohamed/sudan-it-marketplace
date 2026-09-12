# AI Rules — Sudan IT Marketplace & Support App

Shared development rules for AI coding assistants (Cursor, Claude, and similar). Follow this file unless the human explicitly approves an exception.

## Stack and architecture

- Flutter
- Feature-Based Architecture
- Practical Clean Architecture
- Riverpod for state management (added later)
- Firebase as the backend (added later)

---

## 1. General project rules

- Do not change the architecture without explicit approval.
- Do not create random folders or files.
- Prefer small, focused files.
- Avoid unnecessarily large files.
- Keep features modular and independent.
- Do not introduce dependencies unless they are actually needed.

---

## 2. Feature structure

Each feature will eventually follow:

```
feature/
├── data/
├── domain/
└── presentation/
```

Do **not** create these folders until the feature actually needs them.

### Presentation

- Screens
- Widgets
- Providers / state management

### Domain

- Entities
- Repository contracts
- Use cases
- Business rules

### Data

- Models
- Repository implementations
- Data sources
- Firebase / API implementations

---

## 3. Core rules

`core/` is only for shared, **feature-independent** code.

A feature-specific piece of code must **not** be placed in `core` just for convenience.

| Folder | Responsibility |
|--------|----------------|
| `core/constants/` | Shared constants (app-wide values, keys that are not feature-owned) |
| `core/errors/` | Shared failure / exception types and error mapping used across features |
| `core/theme/` | App theme, colors, typography, shared visual tokens |
| `core/utils/` | Generic helpers with no feature-specific business meaning |
| `core/services/` | Shared infrastructure wrappers (e.g. later Firebase client setup), not feature use cases |

---

## 4. State management

Riverpod is the project's state-management solution.

- Do not use `setState` for complex application state.
- Keep UI logic separate from business logic.
- Providers should be organized close to the feature they belong to.
- Do not create global providers unnecessarily.

---

## 5. Firebase

Firebase is the backend.

Planned services:

- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Cloud Functions
- Firebase Cloud Messaging

Rules:

- UI must not contain direct Firestore queries when avoidable.
- Firebase access belongs in the data layer / repositories / data sources.
- Business logic must not depend directly on Firebase APIs.
- Sensitive business logic should use Cloud Functions when appropriate.
- Never store passwords, card information, PINs, or other sensitive secrets in Firestore.

---

## 6. Security

Application roles:

- `customer`
- `company_admin`
- `technician`
- `platform_admin`

Rules:

- Never trust the client for authorization.
- Firestore Security Rules must enforce access control.
- Users must only access data they are authorized to access.
- Company admins must not access another company's private data.
- Technicians must only access permitted / assigned jobs.
- Customers must only access their own private requests, orders, and reviews.

---

## 7. Naming

Use standard Dart / Flutter naming conventions:

- Files: `snake_case`
- Classes: `PascalCase`
- Variables and functions: `camelCase`
- Constants: `lowerCamelCase`, or a project-consistent constant naming style once one is established

Use descriptive names.

---

## 8. Error handling

- Do not silently ignore errors.
- Use a consistent error-handling strategy.
- Keep technical / data errors separate from user-facing messages.

---

## 9. UI rules

- Keep widgets focused.
- Avoid putting business logic directly inside large widgets.
- Extract reusable UI components when there is a real need.
- Do not over-engineer simple widgets.

---

## 10. Development workflow

For every feature follow:

Plan → Model → Data → Repository → Business Logic → State Management → UI → Validation → Testing → Git Commit

Do not implement multiple unrelated features at once.

---

## 11. AI assistant rules

When working on this project:

- First inspect the existing code before modifying it.
- Explain what will be changed before making major architectural changes.
- Do not rewrite working code unnecessarily.
- Do not delete files without explicit approval.
- Do not change dependencies without explaining why.
- Do not refactor unrelated code while implementing a feature.
- If requirements are ambiguous, ask before making a major architectural decision.
- Prefer simple, maintainable solutions over unnecessary abstraction.
- Follow the existing architecture consistently.
- Never assume that a requested feature requires changing the entire architecture.

---

## 12. Git

Changes should be small and logically grouped.

Recommended commit style:

```
feat: add authentication
feat: add companies
feat: add service requests
fix: correct quotation calculation
refactor: improve request repository
```

---

## 13. Project principle

The primary goal is:

**Maintainability + Scalability + Security + Simplicity**

The architecture should make future changes easier, not harder.
