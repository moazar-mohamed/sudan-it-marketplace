# Category trees

Products and services share **one tree of categories**, of any depth.
Platform Admin builds and maintains it; companies only choose from it;
customers browse it. Nothing is stored in the apps: every change Platform
Admin makes shows up live for companies and customers (Firestore listeners).

The tabs on the customer home (Products, Services, Companies) are unchanged.
The Products and Services tabs show the **same categories** (and sub-categories);
choosing one filters that tab's list by the category and everything below it.
The Companies tab has no categories.

## Data

Everything lives in the existing `categories` collection.

| Field | Meaning |
|---|---|
| `parentId` | The parent category, or `null` at the top level. **Source of truth for the shape of the tree.** |
| `ancestorIds` | Ids of every ancestor, top level first (`[]` at the top). Derived from `parentId`; lets the rules refuse a cycle with one lookup. |
| `sortOrder` | Position among its *siblings* (was: position in the one flat list). |
| `nameAr`, `nameEn`, `name`, `description`, `iconName`, `isActive`, `createdAt` | Unchanged. |
| `deletionPending` | `true` while Platform Admin is deleting the category and its tree. Set on the whole subtree first (see Deleting). |

Categories from before trees existed have no `parentId`/`ancestorIds`: they are
simply top-level categories. Nothing needs migrating.

* A product's or service's `categoryId` must be an **active** category that is not
  being deleted. A category can hold products and services at the same time.
* The full path ("Networking > Routers > Wi-Fi 6") is computed from `parentId`
  when needed; it is not stored.
* A category is *shown* to customers and companies only if it and all its
  ancestors are active and none is being deleted (`isEffectivelyActive`).
* Orders, receipts, service requests and chats keep their own copies of names
  (`productName`, `serviceName`, ...) and never point at a category.

There is no depth limit (tested with 60 levels in the rules and 3,000 in the
tree code). The only bound is Firestore's 1 MiB per document: `ancestorIds`
grows by one short id per level.

## Security rules (`firestore.rules`)

* Only Platform Admin creates, edits, moves or deletes categories. Companies,
  technicians, customers and signed-out users cannot; everyone signed in can read.
* Create: active, not pending, and `ancestorIds` == parent's chain + the
  parent; the parent must exist and not be pending.
* Update: when a category's place changes (a move, or the rewrite of a descendant's chain) the
  rules recheck the chain, refuse a category as its own parent and refuse a
  parent that is one of its descendants (its own id is in the parent's chain). The
  parent is read *after* the batch (`getAfter`), so a move and the rewrite of
  everything below it can be one batch.
* Delete: only a category already marked `deletionPending`.
* Products, services and company service offers (`company_services`) can be
  deleted by Platform Admin only while their category is marked
  `deletionPending` (the owning company can still delete its own products, as
  before). Orders, receipts, companies, users and service requests can never be
  deleted this way.
* Nothing can be filed under a category that is inactive or pending.
* There is no `type` field any more: a write that carries one is refused.

**Rule lookup limit.** A request may make 20 `get`/`exists`/`getAfter` calls.
Repeated calls to the same document with the same function count once
(measured in the emulator), so the dashboard packs batches by the documents the
rules look at (`packBatches`, 14 per batch), never by count alone.

## Dashboard operations (`platform_admin_web/src/data/categoryOps.ts`)

No Cloud Functions or Admin SDK: the browser runs each operation as a series of
batches, safe to run again.

* **Create / edit / activate / reorder siblings**: single writes.
* **Move** (any category, with everything below it, under any category of the
  same tree or to the top): writes the category, then its descendants' chains,
  parents before children, in packed batches. A page that stopped part-way is
  detected (`findChainMismatches`), further moves are blocked, and **Repair**
  rewrites every chain from the `parentId` links.
* **Delete** (`deleteCategoryTree`): the dialog first shows the counts (categories,
  products, services, company offers) and what is kept, and needs a tick. Then:
  1. mark every category of the subtree `deletionPending` and inactive (nothing
     new can be attached from now on);
  2. delete the company offers, then the services, then the products filed in
     the subtree (re-queried until none is left);
  3. verify nothing still points at the subtree, then delete the categories,
     deepest first.

  If it stops (network, closed tab) the root is still there, marked; the page
  shows "Finish deleting" and running it again continues. Only documents found
  by `categoryId in <subtree ids>` are deleted; companies, their staff, orders,
  receipts and past service requests are never touched.

## Rollout order (when approved)

1. Deploy `firestore.rules` **and** the Platform Admin hosting together: the new
   rules require a `deletionPending` mark before a delete, which the *old*
   dashboard does not do.
2. Nothing to migrate: existing categories are top-level categories. Sign in as
   Platform Admin and add sub-categories where wanted.
3. Release the app. An app released before this change shows every category,
   sub-categories included, as a flat list, and keeps working.

## Costs on the free plan

Deleting a subtree costs one read per product/service/offer found (twice: once
to count them with aggregate queries, cheap, once to delete) and one write per
document deleted; 5,000 products is about 5,000 reads and 5,000 writes, well
inside the daily 50,000 / 20,000 (a very large deletion can be run over two days:
it resumes). The category list itself is read once per session by each app and
kept live (one read per change).

## Tests

* `platform_admin_web/rules-tests/category-tree.rules.test.ts`: the rules (depth,
  chains, cycles, moves, roles, one tree for products and services, delete gating).
* `platform_admin_web/rules-tests/category-ops.rules.test.ts`: the real dashboard
  operations against the emulator: create, move (wide and deep, half-way stop and
  repair), delete (deep, 850 products, resume after failure, history kept).
* `platform_admin_web/src/data/categoryTree.test.ts`, `categoryOps.test.ts`,
  `src/pages/CategoriesPage.test.tsx`: tree functions, batch packing and retry,
  the management page.
* `test/category_tree_test.dart`, `category_picker_test.dart`,
  `category_browser_test.dart`: the tree, the company picker (products and
  services), customer browsing (same categories on both tabs).
