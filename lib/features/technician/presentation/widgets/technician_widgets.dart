import '../../../../core/widgets/app_widgets.dart';

/// Technician names for the shared design-system widgets. They keep the
/// screens' existing call sites; the look lives in `core/widgets`.
class TechnicianSectionCard extends SectionCard {
  const TechnicianSectionCard({
    super.key,
    super.title,
    required super.children,
    super.trailing,
  });
}

class TechnicianInfoRow extends KeyValueRow {
  const TechnicianInfoRow({
    super.key,
    required super.label,
    required super.value,
    super.valueColor,
    super.valueTextDirection,
  });
}

class TechnicianStatusBadge extends StatusChip {
  const TechnicianStatusBadge({
    super.key,
    required super.label,
    required super.tone,
  });
}

class TechnicianEmptyState extends AppEmptyState {
  const TechnicianEmptyState({
    super.key,
    required super.icon,
    required super.message,
  });
}

class TechnicianErrorState extends AppErrorState {
  const TechnicianErrorState({
    super.key,
    required super.message,
    super.onRetry,
  });
}
