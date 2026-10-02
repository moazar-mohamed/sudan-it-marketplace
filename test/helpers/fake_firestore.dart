// cloud_firestore marks its reference/snapshot classes @sealed to keep app
// code from implementing them; a test-only fake is the one place that must.
// ignore_for_file: subtype_of_sealed_class

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';

/// One write a transaction committed: the document path and the fields it set.
typedef FakeWrite = ({String path, Map<String, dynamic> data});

/// A small in-memory Firestore: just the part of the cloud_firestore API the
/// order data source uses to place, confirm, cancel and expire orders, so the
/// REAL [FirestoreOrdersRemoteDataSource] code runs in a plain `flutter test`
/// without any Firebase connection or extra package.
///
/// Transactions behave like Firestore's: every read must come before any
/// write; reads see the committed data; the writes apply together on commit
/// or not at all; and a commit after another writer changed a document the
/// transaction read is retried with fresh reads (optimistic concurrency), up
/// to `maxAttempts`. There are no security rules here: the rules are tested
/// against the Firestore emulator (platform_admin_web/rules-tests).
class FakeFirestore extends Fake implements FirebaseFirestore {
  final Map<String, Map<String, dynamic>> _docs = {};
  final Map<String, int> _versions = {};

  /// Every committed transaction's writes, oldest first, exactly as sent
  /// (a server timestamp is still the [FieldValue]).
  final List<List<FakeWrite>> commits = [];

  /// How many transaction attempts ran (a retry counts again).
  int transactionAttempts = 0;

  /// Runs between a transaction's handler and its commit, to let "another
  /// device" write in between (for example to confirm the payment).
  void Function(int attempt)? beforeCommit;

  /// When it returns an error code for a path, a commit writing that
  /// document fails with that Firestore error (e.g. 'permission-denied').
  String? Function(String path)? rejectCommit;

  /// When set, the next commit IS applied but still fails with this error
  /// code, as when the connection drops before the answer arrives.
  String? acknowledgementLost;

  /// When set, a commit whose reads are stale fails with this error code
  /// instead of being retried, as the emulator does when its security rules
  /// see the newer data and refuse ('permission-denied').
  String? staleCommitCode;

  /// When set, a server timestamp is stored as this clock's time (as the
  /// server would), instead of as the [FieldValue] that was sent.
  DateTime Function()? serverClock;

  /// Makes every query fail (e.g. offline).
  bool failQueries = false;

  /// Makes every single-document read outside a transaction fail (e.g. the
  /// connection dropped).
  bool failReads = false;

  /// Stores [data] at [path] as another writer would.
  void put(String path, Map<String, dynamic> data) {
    _docs[path] = Map.of(data);
    _versions[path] = (_versions[path] ?? 0) + 1;
  }

  void remove(String path) {
    _docs.remove(path);
    _versions[path] = (_versions[path] ?? 0) + 1;
  }

  Map<String, dynamic>? read(String path) =>
      _docs[path] == null ? null : Map.of(_docs[path]!);

  @override
  CollectionReference<Map<String, dynamic>> collection(String collectionPath) =>
      _FakeCollection(this, collectionPath);

  @override
  Future<T> runTransaction<T>(
    TransactionHandler<T> transactionHandler, {
    Duration timeout = const Duration(seconds: 30),
    int maxAttempts = 5,
  }) async {
    for (var attempt = 1; ; attempt++) {
      transactionAttempts++;
      final transaction = _FakeTransaction(this);
      // An exception from the handler aborts the transaction: nothing written.
      final result = await transactionHandler(transaction);
      beforeCommit?.call(attempt);
      final stale = transaction.readVersions.entries
          .any((read) => (_versions[read.key] ?? 0) != read.value);
      if (stale) {
        final refusal = staleCommitCode;
        if (refusal != null) {
          throw FirebaseException(plugin: 'cloud_firestore', code: refusal);
        }
        if (attempt >= maxAttempts) {
          throw FirebaseException(plugin: 'cloud_firestore', code: 'aborted');
        }
        continue;
      }
      for (final write in transaction.writes) {
        final code = rejectCommit?.call(write.path);
        if (code != null) {
          throw FirebaseException(plugin: 'cloud_firestore', code: code);
        }
      }
      // An update needs its document to exist; checked for every write before
      // any is applied, so a failed commit leaves nothing behind.
      for (final write in transaction.writes) {
        if (!transaction.sets.contains(write.path) &&
            _docs[write.path] == null) {
          throw FirebaseException(plugin: 'cloud_firestore', code: 'not-found');
        }
      }
      for (final write in transaction.writes) {
        _apply(write, replace: transaction.sets.contains(write.path));
      }
      commits.add(List.unmodifiable(transaction.writes));
      final lost = acknowledgementLost;
      if (lost != null) {
        acknowledgementLost = null;
        throw FirebaseException(plugin: 'cloud_firestore', code: lost);
      }
      return result;
    }
  }

  /// A set replaces (or creates) the document; an update merges into it.
  void _apply(FakeWrite write, {required bool replace}) {
    final clock = serverClock;
    final data = {
      for (final entry in write.data.entries)
        entry.key: clock != null && entry.value == FieldValue.serverTimestamp()
            ? Timestamp.fromDate(clock())
            : entry.value,
    };
    _docs[write.path] = replace ? data : {..._docs[write.path]!, ...data};
    _versions[write.path] = (_versions[write.path] ?? 0) + 1;
  }

  /// A plain (non-transaction) update of one document, refused like a commit.
  Future<void> _update(String path, Map<String, dynamic> data) async {
    final code = rejectCommit?.call(path);
    if (code != null) {
      throw FirebaseException(plugin: 'cloud_firestore', code: code);
    }
    if (_docs[path] == null) {
      throw FirebaseException(plugin: 'cloud_firestore', code: 'not-found');
    }
    final write = (path: path, data: data);
    _apply(write, replace: false);
    commits.add(List.unmodifiable([write]));
  }
}

class _FakeTransaction extends Fake implements Transaction {
  _FakeTransaction(this._store);

  final FakeFirestore _store;
  final Map<String, int> readVersions = {};
  final List<FakeWrite> writes = [];

  /// The paths written with [set] (whole documents) rather than [update].
  final Set<String> sets = {};

  @override
  Future<DocumentSnapshot<T>> get<T extends Object?>(
    DocumentReference<T> documentReference,
  ) async {
    if (writes.isNotEmpty) {
      throw StateError('Firestore transactions must do all reads before writes');
    }
    final path = documentReference.path;
    readVersions[path] = _store._versions[path] ?? 0;
    return _FakeDocumentSnapshot(
      _store,
      path,
      _store.read(path),
    ) as DocumentSnapshot<T>;
  }

  @override
  Transaction update(
    DocumentReference documentReference,
    Map<Object, Object?> data,
  ) {
    writes.add((
      path: documentReference.path,
      data: {for (final entry in data.entries) entry.key as String: entry.value},
    ));
    return this;
  }

  @override
  Transaction set<T>(
    DocumentReference<T> documentReference,
    T data, [
    SetOptions? options,
  ]) {
    if (options != null) {
      throw UnimplementedError('merge options are not faked');
    }
    sets.add(documentReference.path);
    writes.add((
      path: documentReference.path,
      data: Map<String, dynamic>.of(data as Map<String, dynamic>),
    ));
    return this;
  }
}

class _FakeCollection extends _FakeQuery
    implements CollectionReference<Map<String, dynamic>> {
  _FakeCollection(FakeFirestore store, String path) : super(store, path, const {});

  @override
  String get path => _collection;

  @override
  String get id => _collection;

  @override
  DocumentReference<Map<String, dynamic>> doc([String? path]) {
    if (path == null) {
      throw UnimplementedError('auto ids are not needed by these tests');
    }
    return _FakeDocumentReference(_store, '$_collection/$path');
  }
}

class _FakeQuery extends Fake implements Query<Map<String, dynamic>> {
  _FakeQuery(this._store, this._collection, this._equals);

  final FakeFirestore _store;
  final String _collection;
  final Map<String, Object?> _equals;

  @override
  Query<Map<String, dynamic>> where(
    Object field, {
    Object? isEqualTo,
    Object? isNotEqualTo,
    Object? isLessThan,
    Object? isLessThanOrEqualTo,
    Object? isGreaterThan,
    Object? isGreaterThanOrEqualTo,
    Object? arrayContains,
    Iterable<Object?>? arrayContainsAny,
    Iterable<Object?>? whereIn,
    Iterable<Object?>? whereNotIn,
    bool? isNull,
  }) {
    final onlyEquality = isNotEqualTo == null &&
        isLessThan == null &&
        isLessThanOrEqualTo == null &&
        isGreaterThan == null &&
        isGreaterThanOrEqualTo == null &&
        arrayContains == null &&
        arrayContainsAny == null &&
        whereIn == null &&
        whereNotIn == null &&
        isNull == null;
    if (!onlyEquality) {
      throw UnimplementedError('only isEqualTo filters are faked');
    }
    return _FakeQuery(_store, _collection, {..._equals, field as String: isEqualTo});
  }

  @override
  Future<QuerySnapshot<Map<String, dynamic>>> get([GetOptions? options]) async {
    if (_store.failQueries) {
      throw FirebaseException(plugin: 'cloud_firestore', code: 'unavailable');
    }
    final prefix = '$_collection/';
    final docs = <QueryDocumentSnapshot<Map<String, dynamic>>>[
      for (final entry in _store._docs.entries)
        if (entry.key.startsWith(prefix) &&
            !entry.key.substring(prefix.length).contains('/') &&
            _equals.entries.every((f) => entry.value[f.key] == f.value))
          _FakeQueryDocumentSnapshot(_store, entry.key, Map.of(entry.value)),
    ];
    return _FakeQuerySnapshot(docs);
  }
}

class _FakeDocumentReference extends Fake
    implements DocumentReference<Map<String, dynamic>> {
  _FakeDocumentReference(this._store, this.path);

  final FakeFirestore _store;

  @override
  final String path;

  @override
  String get id => path.split('/').last;

  @override
  Future<DocumentSnapshot<Map<String, dynamic>>> get([GetOptions? options]) async {
    if (_store.failReads) {
      throw FirebaseException(plugin: 'cloud_firestore', code: 'unavailable');
    }
    return _FakeDocumentSnapshot(_store, path, _store.read(path));
  }

  @override
  Future<void> update(Map<Object, Object?> data) => _store._update(path, {
        for (final entry in data.entries) entry.key as String: entry.value,
      });
}

class _FakeDocumentSnapshot extends Fake
    implements DocumentSnapshot<Map<String, dynamic>> {
  _FakeDocumentSnapshot(this._store, this._path, this._data);

  final FakeFirestore _store;
  final String _path;
  final Map<String, dynamic>? _data;

  @override
  String get id => _path.split('/').last;

  @override
  bool get exists => _data != null;

  @override
  Map<String, dynamic>? data() => _data == null ? null : Map.of(_data);

  @override
  DocumentReference<Map<String, dynamic>> get reference =>
      _FakeDocumentReference(_store, _path);
}

class _FakeQueryDocumentSnapshot extends Fake
    implements QueryDocumentSnapshot<Map<String, dynamic>> {
  _FakeQueryDocumentSnapshot(this._store, this._path, this._data);

  final FakeFirestore _store;
  final String _path;
  final Map<String, dynamic> _data;

  @override
  String get id => _path.split('/').last;

  @override
  bool get exists => true;

  @override
  Map<String, dynamic> data() => Map.of(_data);

  @override
  DocumentReference<Map<String, dynamic>> get reference =>
      _FakeDocumentReference(_store, _path);
}

class _FakeQuerySnapshot extends Fake
    implements QuerySnapshot<Map<String, dynamic>> {
  _FakeQuerySnapshot(this.docs);

  @override
  final List<QueryDocumentSnapshot<Map<String, dynamic>>> docs;

  @override
  int get size => docs.length;
}
