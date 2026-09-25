# Payment receipts

Customers pay a company by bank transfer outside the app and attach a photo or
screenshot of the transfer as proof. The company (and Platform Admin) look at it
before confirming the payment.

The project is on the **Firebase Spark (free) plan**, where Cloud Storage is not
available. Receipts are therefore stored **in Firestore**, as compressed JPEG
bytes. No Firebase Storage, no third-party image host, no public URLs.

## How it works

| Step | What happens |
|---|---|
| Pick | The customer chooses "Choose from device" or "Take a photo". |
| Compress | The app (background isolate) decodes the image, applies the photo's orientation, flattens transparency onto white, and encodes a JPEG: longest side up to 1280 px, quality 70, stepping down until it is at most **350 KB** (target). A hard limit of **700,000 bytes** applies; an image that cannot get under it is refused with a clear message. |
| Place the order | The order, the stock reservation and the receipt are written in **one Firestore transaction** (`orders/{id}`, `products/{id}`, `order_receipts/{id}`). Either all exist or none. |
| View | The customer, the owning company's admin and Platform Admin tap **View receipt**. The image is read on demand (`order_receipts/{orderId}`), never with order lists. |

## Data

`order_receipts/{orderId}` (same id as the order):

```
orderId, customerId, companyId   strings; must match the order
fileName                         string, 1-100 chars (also the order's receiptFileName marker)
contentType                      'image/jpeg'
image                            bytes, 1..700,000 B  (native Firestore bytes, not base64)
sizeBytes                        int, equals image length
width, height                    int, 1..4096
createdAt                        server timestamp
```

The order document is unchanged: it keeps `receiptFileName` as the "has a
receipt" marker. Orders placed before this feature have no receipt document; the
viewer says "No receipt image is available for this order."

## Security (enforced in `firestore.rules`, tested in `rules-tests/order-receipts.rules.test.ts`)

* **Read** (single document only): the order's customer, the owning company's
  admin, Platform Admin. Technicians (even the one assigned to the order),
  other customers and other companies are refused. No listing for anyone.
* **Create**: only the order's own customer, alongside or after their order, for
  an order still `pending_verification`, with the exact field set and limits
  above.
* **Immutable**: no update and no delete for anyone, including Platform Admin.
  Deleting a company never touches orders or their receipts.
* The rules cannot inspect the bytes, so `contentType` is a claim; the app
  always produces a real JPEG. A hostile client could store other bytes in the
  size limit, readable only by the three parties above.
* Receipts are cached on the phone of whoever viewed them (Firestore's local
  cache), like any Firestore data.

## Capacity: read this before growing

The Spark plan's free database is **1 GiB in total** (all collections). Receipts
are never deleted, so they are the main thing that fills it.

| Average stored receipt | Orders before 1 GiB is full (receipts only) |
|---|---|
| 150 KB | about 6,800 |
| 300 KB | about 3,400 |
| 700 KB (worst case) | about 1,500 |

Other free limits that matter: 50,000 reads/day and 20,000 writes/day, 10 GiB
outbound data per month. Viewing a receipt is 1 read (2 for a company admin or
Platform Admin, because the rules also read the user's profile), so about 35,000
views a month fit in the free transfer allowance at 300 KB each.

What Firestore does once a free quota is exhausted on Spark is not spelled out
in the documentation; expect writes (new orders) to be refused.

### Monitoring recommendation (no in-app metric)

The app **cannot measure** database size or quota use accurately, so it does not
show any number. Instead:

1. Once a month, open **Firebase Console -> Firestore Database -> Usage** and
   note the stored data size and the daily reads/writes. Check it after any
   marketing push or a burst of orders.
2. Treat **600 MB** as the point to decide what to do next (about 60% full);
   treat **800 MB** as urgent.
3. Watch the average receipt size: if it is well above 300 KB, lower
   `ReceiptLimits.targetBytes` / the quality ladder in
   `lib/core/services/receipt_image_compressor.dart` (this only affects new
   orders).

### Options when it fills up (each needs an explicit decision)

* Move the project to the paid Blaze plan and, if wanted, Cloud Storage.
* Add a policy to shrink or remove receipt images of old, completed orders
  (this is deliberately **not** implemented: receipts are immutable and nothing
  deletes them automatically).
* Compress harder for new receipts.

## Tests

* `rules-tests/order-receipts.rules.test.ts`: ownership, roles, size, type,
  immutability, order association, transaction and batch behaviour, legacy
  orders, company deletion. Run with `npm run test:rules` in `platform_admin_web`.
* `test/receipt_upload_test.dart`: compression, the app/rules field and limit
  agreement, the payment screen, the viewer, and technician isolation.
* `platform_admin_web/src/components/ReceiptViewer.test.tsx`,
  `src/data/receipts.test.ts`: the Platform Admin viewer.
