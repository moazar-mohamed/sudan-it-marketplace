import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/chat_conversation.dart';
import '../../domain/entities/chat_message.dart';

/// Firestore mapping of `chats/{id}` and `chats/{id}/messages/{messageId}`.
class ChatModels {
  const ChatModels._();

  static ChatConversation conversationFromFirestore(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? const <String, dynamic>{};
    return ChatConversation(
      id: snapshot.id,
      serviceRequestId: data['serviceRequestId'] as String?,
      orderId: data['orderId'] as String?,
      productId: data['productId'] as String?,
      companyServiceId: data['companyServiceId'] as String?,
      customerId: data['customerId'] as String? ?? '',
      companyId: data['companyId'] as String? ?? '',
      customerName: data['customerName'] as String? ?? '',
      companyName: data['companyName'] as String? ?? '',
      serviceName: data['serviceName'] as String? ?? '',
      productName: data['productName'] as String? ?? '',
      createdAt: _date(data, 'createdAt') ?? DateTime.now(),
      lastMessageText: data['lastMessageText'] as String?,
      lastMessageAt: _date(data, 'lastMessageAt'),
      lastMessageSenderRole: ChatParticipantRole.fromValue(
        data['lastMessageSenderRole'] as String?,
      ),
      customerLastReadAt: _date(data, 'customerLastReadAt'),
      companyLastReadAt: _date(data, 'companyLastReadAt'),
    );
  }

  static ChatMessage messageFromFirestore(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? const <String, dynamic>{};
    return ChatMessage(
      id: snapshot.id,
      senderId: data['senderId'] as String? ?? '',
      senderRole: ChatParticipantRole.fromValue(data['senderRole'] as String?) ??
          ChatParticipantRole.customer,
      senderName: data['senderName'] as String? ?? '',
      text: data['text'] as String? ?? '',
      createdAt: _date(data, 'createdAt') ?? DateTime.now(),
      isPending: snapshot.metadata.hasPendingWrites,
    );
  }

  /// The conversation written together with a brand-new service request.
  static Map<String, dynamic> serviceRequestChatCreateMap({
    required String serviceRequestId,
    required String customerId,
    required String companyId,
    required String customerName,
    required String companyName,
    required String serviceName,
  }) {
    return _createMap(
      id: serviceRequestId,
      serviceRequestId: serviceRequestId,
      orderId: null,
      customerId: customerId,
      companyId: companyId,
      customerName: customerName,
      companyName: companyName,
      serviceName: serviceName,
      productName: '',
    );
  }

  /// The conversation for one order: written together with a brand-new
  /// order, or on its own for an order placed before conversations existed.
  static Map<String, dynamic> orderChatCreateMap({
    required String orderId,
    required String customerId,
    required String companyId,
    required String customerName,
    required String companyName,
    required String productName,
  }) {
    return _createMap(
      id: orderId,
      serviceRequestId: null,
      orderId: orderId,
      customerId: customerId,
      companyId: companyId,
      customerName: customerName,
      companyName: companyName,
      serviceName: '',
      productName: productName,
    );
  }

  /// A customer's questions to a company about one product, before ordering.
  static Map<String, dynamic> productInquiryChatCreateMap({
    required String customerId,
    required String companyId,
    required String customerName,
    required String companyName,
    required String productId,
    required String productName,
  }) {
    return {
      ..._createMap(
        id: ChatConversation.productInquiryId(customerId, productId),
        serviceRequestId: null,
        orderId: null,
        customerId: customerId,
        companyId: companyId,
        customerName: customerName,
        companyName: companyName,
        serviceName: '',
        productName: productName,
      ),
      'productId': productId,
    };
  }

  /// A customer's questions to a company about its offer of one service,
  /// before requesting it.
  static Map<String, dynamic> serviceInquiryChatCreateMap({
    required String customerId,
    required String companyId,
    required String customerName,
    required String companyName,
    required String companyServiceId,
    required String serviceName,
  }) {
    return {
      ..._createMap(
        id: ChatConversation.serviceInquiryId(customerId, companyServiceId),
        serviceRequestId: null,
        orderId: null,
        customerId: customerId,
        companyId: companyId,
        customerName: customerName,
        companyName: companyName,
        serviceName: serviceName,
        productName: '',
      ),
      'companyServiceId': companyServiceId,
    };
  }

  static Map<String, dynamic> _createMap({
    required String id,
    required String? serviceRequestId,
    required String? orderId,
    required String customerId,
    required String companyId,
    required String customerName,
    required String companyName,
    required String serviceName,
    required String productName,
  }) {
    return {
      'id': id,
      'serviceRequestId': serviceRequestId,
      'orderId': orderId,
      'customerId': customerId,
      'companyId': companyId,
      'customerName': customerName,
      'companyName': companyName,
      'serviceName': serviceName,
      'productName': productName,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  static String readKeyFor(ChatParticipantRole role) =>
      role == ChatParticipantRole.customer
          ? 'customerLastReadAt'
          : 'companyLastReadAt';

  /// A timestamp field. A server timestamp this device has just written reads
  /// as null until the server confirms it; it is treated as "now".
  static DateTime? _date(Map<String, dynamic> data, String key) {
    if (!data.containsKey(key)) return null;
    final value = data[key];
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return value == null ? DateTime.now() : null;
  }
}
