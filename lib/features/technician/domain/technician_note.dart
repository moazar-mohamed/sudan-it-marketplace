/// What the technician wrote down about one job. Kept apart from the order
/// (`orders/{id}/technicianNotes`) so the customer, who can read the order,
/// cannot read it: only the job's company and its technician can.
class TechnicianNote {
  const TechnicianNote({
    required this.id,
    required this.orderId,
    required this.authorId,
    required this.authorName,
    required this.kind,
    required this.text,
    required this.createdAt,
  });

  /// Longest note the app (and the security rules) accept.
  static const maxLength = 500;

  final String id;
  final String orderId;
  final String authorId;
  final String authorName;
  final TechnicianNoteKind kind;
  final String text;
  final DateTime createdAt;
}

enum TechnicianNoteKind {
  /// A note added while working on the job.
  note('note'),

  /// The remark left when the technician finished the job.
  completion('completion');

  const TechnicianNoteKind(this.value);

  final String value;

  static TechnicianNoteKind fromValue(Object? value) =>
      value == 'completion' ? completion : note;
}
