import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/auth_state.dart';
import '../data/datasources/firestore_orders_remote_data_source.dart';
import '../data/datasources/orders_remote_data_source.dart';
import '../data/repositories/orders_repository_impl.dart';
import '../domain/entities/order_entity.dart';
import '../domain/repositories/orders_repository.dart';
import '../domain/entities/order_receipt.dart';

final ordersRemoteDataSourceProvider = Provider<OrdersRemoteDataSource>((ref) {
  return FirestoreOrdersRemoteDataSource();
});

final ordersRepositoryProvider = Provider<OrdersRepository>((ref) {
  return OrdersRepositoryImpl(ref.watch(ordersRemoteDataSourceProvider));
});

/// The stored receipt image of one order, read on demand (never with the
/// order lists) and dropped when the screen closes. Null = no image stored.
///
/// A failed read is NOT retried automatically (Riverpod's default would repeat
/// it up to ten times): every read of a receipt spends part of the free daily
/// read quota, so the reader taps "Try again" instead.
final orderReceiptProvider =
    FutureProvider.autoDispose.family<OrderReceipt?, String>(
  (ref, orderId) => ref.watch(ordersRepositoryProvider).getReceipt(orderId),
  retry: (retryCount, error) => null,
);

final customerOrdersStreamProvider = StreamProvider<List<OrderEntity>>((ref) {
  final authState = ref.watch(authControllerProvider);
  final customerId = switch (authState) {
    AuthAuthenticated(:final user) => user.id,
    _ => FirebaseAuth.instance.currentUser?.uid,
  };

  if (customerId == null || customerId.isEmpty) {
    return Stream.value(const []);
  }

  final repository = ref.watch(ordersRepositoryProvider);
  return repository.watchCustomerOrders(customerId);
});

final companyOrdersStreamProvider =
    StreamProvider.family<List<OrderEntity>, String>((ref, companyId) {
  if (companyId.isEmpty) {
    return Stream.value(const []);
  }
  return ref.watch(ordersRepositoryProvider).watchCompanyOrders(companyId);
});

final technicianOrdersStreamProvider =
    StreamProvider.family<List<OrderEntity>, String>((ref, technicianId) {
  if (technicianId.isEmpty) {
    return Stream.value(const []);
  }
  return ref
      .watch(ordersRepositoryProvider)
      .watchTechnicianOrders(technicianId);
});
