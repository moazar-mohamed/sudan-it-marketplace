import '../../../../core/widgets/app_widgets.dart';

/// Company Admin names for the shared design-system widgets. They keep the
/// screens' existing call sites; the look lives in `core/widgets`.
class AdminSectionCard extends SectionCard {
  const AdminSectionCard({
    super.key,
    super.title,
    required super.children,
    super.trailing,
  });
}

/// Label at the start, value at the end; long values wrap.
class AdminInfoRow extends KeyValueRow {
  const AdminInfoRow({
    super.key,
    required super.label,
    required super.value,
    super.valueColor,
    super.emphasize,
    super.valueTextDirection,
  });
}

class AdminEmptyState extends AppEmptyState {
  const AdminEmptyState({
    super.key,
    required super.icon,
    required super.message,
    super.action,
  });
}

class AdminErrorState extends AppErrorState {
  const AdminErrorState({super.key, required super.message, super.onRetry});
}
