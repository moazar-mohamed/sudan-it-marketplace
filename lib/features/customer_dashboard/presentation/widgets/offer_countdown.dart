import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';

/// "Ends in 18 : 42 : 05" for the offer that ends first. Under a day it ticks
/// every second; further away it says how many days are left and only
/// re-checks every minute. Shows nothing once the time is up.
class OfferCountdown extends StatefulWidget {
  const OfferCountdown({
    super.key,
    required this.endsAt,
    this.now = DateTime.now,
  });

  final DateTime endsAt;

  /// The clock, replaceable in tests.
  final DateTime Function() now;

  @override
  State<OfferCountdown> createState() => _OfferCountdownState();
}

class _OfferCountdownState extends State<OfferCountdown> {
  Timer? _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = _left();
    _schedule();
  }

  @override
  void didUpdateWidget(OfferCountdown old) {
    super.didUpdateWidget(old);
    if (old.endsAt != widget.endsAt) {
      _remaining = _left();
      _schedule();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Duration _left() => widget.endsAt.difference(widget.now());

  void _schedule() {
    _timer?.cancel();
    if (_remaining <= Duration.zero) return;
    final period = _remaining >= const Duration(days: 1)
        ? const Duration(minutes: 1)
        : const Duration(seconds: 1);
    _timer = Timer(period, () {
      if (!mounted) return;
      setState(() => _remaining = _left());
      _schedule();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_remaining <= Duration.zero) return const SizedBox.shrink();
    final colors = context.colors;
    final l10n = context.l10n;
    final label = AppTextStyles.caption.copyWith(color: colors.textSecondary);
    if (_remaining >= const Duration(days: 1)) {
      return Text(
        l10n.homeOffersEndsInDays(_remaining.inDays),
        key: const ValueKey('offers-countdown'),
        style: label,
      );
    }
    String two(int n) => n.toString().padLeft(2, '0');
    final parts = [
      two(_remaining.inHours),
      two(_remaining.inMinutes.remainder(60)),
      two(_remaining.inSeconds.remainder(60)),
    ];
    return Row(
      key: const ValueKey('offers-countdown'),
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l10n.homeOffersEndsIn, style: label),
        const SizedBox(width: AppSpacing.s8),
        for (var i = 0; i < parts.length; i++) ...[
          if (i > 0)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s4),
              child: Text(':', style: AppTextStyles.captionStrong),
            ),
          DecoratedBox(
            decoration: BoxDecoration(
              color: colors.bgInverse,
              borderRadius: AppRadius.smAll,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.s8,
                vertical: AppSpacing.s2,
              ),
              child: Text(
                parts[i],
                style: AppTextStyles.captionStrong.copyWith(
                  color: colors.textInverse,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
