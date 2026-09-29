/// Which side of a service-request conversation a user speaks for.
enum ChatParticipantRole {
  customer('customer'),
  company('company');

  const ChatParticipantRole(this.value);

  final String value;

  static ChatParticipantRole? fromValue(String? value) {
    for (final role in values) {
      if (role.value == value) return role;
    }
    return null;
  }
}

/// The conversation between a customer and the company they contacted, about
/// a service request, a product order, or - before ordering anything - one
/// product or service offer (an inquiry). Exactly one of [serviceRequestId],
/// [orderId], [productId] and [companyServiceId] is set. A request's or an
/// order's conversation has that request's or order's id; an inquiry has the
/// fixed id from [productInquiryId]/[serviceInquiryId], so asking about the
/// same thing again reopens the same conversation.
class ChatConversation {
  const ChatConversation({
    required this.id,
    this.serviceRequestId,
    this.orderId,
    this.productId,
    this.companyServiceId,
    required this.customerId,
    required this.companyId,
    required this.customerName,
    required this.companyName,
    this.serviceName = '',
    this.productName = '',
    required this.createdAt,
    this.lastMessageText,
    this.lastMessageAt,
    this.lastMessageSenderRole,
    this.customerLastReadAt,
    this.companyLastReadAt,
  });

  /// The conversation id of [customerId]'s questions about one product.
  static String productInquiryId(String customerId, String productId) =>
      '${customerId}_product_$productId';

  /// The conversation id of [customerId]'s questions about one company's
  /// offer of a service (a `company_services` link).
  static String serviceInquiryId(String customerId, String companyServiceId) =>
      '${customerId}_service_$companyServiceId';

  final String id;
  final String? serviceRequestId;
  final String? orderId;

  /// The product asked about in an inquiry.
  final String? productId;

  /// The company's service offer asked about in an inquiry.
  final String? companyServiceId;
  final String customerId;
  final String companyId;
  final String customerName;
  final String companyName;

  /// The service it is about; empty for a product's conversation.
  final String serviceName;

  /// The product it is about; empty for a service's conversation.
  final String productName;
  final DateTime createdAt;
  final String? lastMessageText;
  final DateTime? lastMessageAt;
  final ChatParticipantRole? lastMessageSenderRole;
  final DateTime? customerLastReadAt;
  final DateTime? companyLastReadAt;

  bool get isOrderChat => orderId != null;

  /// A question asked before ordering: no order or request behind it yet.
  bool get isInquiry => orderId == null && serviceRequestId == null;

  /// What the conversation is about: the service name, or the product name.
  String get subjectLabel =>
      isOrderChat || productId != null ? productName : serviceName;

  /// When anything last happened here (used to order the conversation list).
  DateTime get activityAt => lastMessageAt ?? createdAt;

  bool get hasMessages => lastMessageAt != null;

  /// True when the other side wrote the latest message and [role] has not
  /// opened the conversation since.
  bool isUnreadFor(ChatParticipantRole role) {
    final lastAt = lastMessageAt;
    if (lastAt == null || lastMessageSenderRole == null) return false;
    if (lastMessageSenderRole == role) return false;
    final readAt = role == ChatParticipantRole.customer
        ? customerLastReadAt
        : companyLastReadAt;
    return readAt == null || readAt.isBefore(lastAt);
  }
}
