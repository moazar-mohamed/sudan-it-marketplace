import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether Platform Admin deleted this account: a record at
/// `deleted_accounts/{uid}` (the person may read their own; the security rules
/// also stop them making a new profile). Asked only when there is no profile to
/// show, so it never slows a normal sign-in. When it cannot be read the account
/// is treated as not deleted: the profile problem is then shown as before.
final accountDeletedProvider = FutureProvider.family<bool, String>((
  ref,
  uid,
) async {
  try {
    final snapshot = await FirebaseFirestore.instance
        .collection('deleted_accounts')
        .doc(uid)
        .get();
    return snapshot.exists;
  } catch (_) {
    return false;
  }
});
