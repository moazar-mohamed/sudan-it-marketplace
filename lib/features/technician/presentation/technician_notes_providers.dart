import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/technician_notes_store.dart';
import '../domain/technician_note.dart';

final technicianNotesStoreProvider = Provider<TechnicianNotesStore>((ref) {
  return TechnicianNotesStore();
});

/// The notes a technician left on one job, newest first.
final technicianNotesProvider =
    StreamProvider.family<List<TechnicianNote>, String>((ref, orderId) {
  if (orderId.isEmpty) return Stream.value(const []);
  return ref.watch(technicianNotesStoreProvider).watch(orderId);
});
