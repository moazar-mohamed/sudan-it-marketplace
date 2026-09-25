/// The short reference people read and say for an order, job or service
/// request: the first 8 characters of its id, shown as `#` + this value.
///
/// One rule for every screen and role (customer, company admin, technician),
/// so the number a customer sees is the number the company finds. Search
/// matches the full id, which contains this prefix. The stored id never changes.
String shortReference(String id) => id.length > 8 ? id.substring(0, 8) : id;
