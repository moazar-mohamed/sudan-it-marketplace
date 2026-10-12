import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/logging/debug_log.dart';
import '../../../core/localization/error_messages.dart';
import '../../../core/localization/locale_controller.dart';
import '../../notifications/presentation/notification_events.dart';
import '../../notifications/presentation/notifications_providers.dart';
import '../../orders/domain/entities/order_entity.dart';
import '../../orders/presentation/orders_providers.dart';
import '../../chats/presentation/chat_providers.dart';
import '../domain/technician_note.dart';
import 'technician_notes_providers.dart';

final technicianActionsProvider = Provider<TechnicianActions>((ref) {
  return TechnicianActions(ref);
});

/// Write operations used by the Technician screens. Each method returns
/// null on success or a user-facing error message.
class TechnicianActions {
  TechnicianActions(this._ref);

  final Ref _ref;

  Future<String?> advanceJobStatus(OrderEntity order, OrderStatus status) {
    return _guard(() async {
      await _ref.read(ordersRepositoryProvider).updateOrderStatus(
            orderId: order.id,
            orderStatus: status,
          );
      final notifications = _ref.read(notificationsRepositoryProvider);
      final event = NotificationEvents.forOrderStatusChange(
        status: status,
        orderId: order.id,
        customerId: order.customerId,
        productName: order.productName,
      );
      if (event != null) {
        await notifications.createNotification(event);
      }
      // The company hears that its technician finished. Best effort.
      if (status == OrderStatus.completed) {
        try {
          await notifications.createNotification(
            NotificationEvents.jobCompleted(
              orderId: order.id,
              companyId: order.companyId,
              productName: order.productName,
            ),
          );
        } catch (error) {
          debugLog('TechnicianActions', 'job_completed not sent: $error');
        }
      }
    });
  }

  /// Writes a note on [order] as its technician. The customer cannot read it.
  Future<String?> addNote(
    OrderEntity order, {
    required String text,
    TechnicianNoteKind kind = TechnicianNoteKind.note,
  }) {
    return _guard(() async {
      final uid = _ref.read(currentUserIdProvider);
      if (uid == null) {
        throw const AppException(AppErrorCode.chatSendDenied);
      }
      await _ref.read(technicianNotesStoreProvider).add(
            orderId: order.id,
            companyId: order.companyId,
            technicianId: order.technicianId ?? '',
            authorId: uid,
            authorName: order.technicianName ?? '',
            kind: kind,
            text: text,
          );
    });
  }

  Future<String?> deleteNote(OrderEntity order, TechnicianNote note) {
    return _guard(() {
      return _ref
          .read(technicianNotesStoreProvider)
          .delete(orderId: order.id, noteId: note.id);
    });
  }

  /// Marks the job completed and, when the technician left one, keeps their
  /// remark for the company. The remark is written after the status change:
  /// a failure of the remark never undoes the completion.
  Future<String?> finishJob(OrderEntity order, {String note = ''}) async {
    final error = await advanceJobStatus(order, OrderStatus.completed);
    if (error != null || note.trim().isEmpty) return error;
    return addNote(
      order,
      text: note,
      kind: TechnicianNoteKind.completion,
    );
  }

  Future<String?> _guard(Future<void> Function() action) async {
    try {
      await action();
      return null;
    } catch (error) {
      return localizedErrorMessage(_ref.read(appLocalizationsProvider), error);
    }
  }
}
