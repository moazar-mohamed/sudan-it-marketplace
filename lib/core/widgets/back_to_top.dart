import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../localization/l10n_extension.dart';
import '../theme/app_colors.dart';

/// Whether the button shows, given the scroll position: never in the first
/// screen and a half; while reading on it stays out of the way (hidden on the
/// way down), and it comes back on the way up and near the end of the page.
/// Mirrors the site's BackToTop.
bool backToTopVisible({
  required bool was,
  required double pixels,
  required double last,
  required double viewport,
  required double max,
}) {
  if (pixels < viewport * 1.5) return false;
  if (max > 0 && pixels >= max - viewport * 0.5) return true;
  if (pixels < last - 4) return true;
  if (pixels > last + 4) return false;
  return was;
}

/// The modern "back to top" button over a long page: a round button with a
/// ring that fills as the page is read. It follows the page's own vertical
/// scroll (no controller needed) and scrolls it back to the top.
class BackToTop extends StatefulWidget {
  const BackToTop({super.key, required this.child});

  final Widget child;

  @override
  State<BackToTop> createState() => _BackToTopState();
}

class _BackToTopState extends State<BackToTop> {
  ScrollPosition? _position;
  bool _visible = false;
  double _progress = 0;
  double _last = 0;

  bool _onScroll(ScrollNotification n) {
    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;
    final context = n.context;
    if (context != null) _position = Scrollable.maybeOf(context)?.position;
    final m = n.metrics;
    final visible = backToTopVisible(
      was: _visible,
      pixels: m.pixels,
      last: _last,
      viewport: m.viewportDimension,
      max: m.maxScrollExtent,
    );
    _last = m.pixels;
    final progress = m.maxScrollExtent > 0
        ? (m.pixels / m.maxScrollExtent).clamp(0.0, 1.0)
        : 0.0;
    if (visible != _visible || (progress - _progress).abs() > 0.01) {
      setState(() {
        _visible = visible;
        _progress = progress;
      });
    }
    return false;
  }

  void _toTop() {
    final position = _position;
    if (position == null || !position.hasPixels) return;
    if (MediaQuery.of(context).disableAnimations) {
      position.jumpTo(0);
    } else {
      position.animateTo(
        0,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final label = context.l10n.backToTop;
    return NotificationListener<ScrollNotification>(
      onNotification: _onScroll,
      child: Stack(
        children: [
          widget.child,
          PositionedDirectional(
            end: 16,
            bottom: 16,
            child: SafeArea(
              top: false,
              child: IgnorePointer(
                ignoring: !_visible,
                child: AnimatedSlide(
                  offset: _visible ? Offset.zero : const Offset(0, 0.4),
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeOutCubic,
                  child: AnimatedOpacity(
                    opacity: _visible ? 1 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Semantics(
                      button: true,
                      label: label,
                      excludeSemantics: true,
                      child: Tooltip(
                        message: label,
                        child: Material(
                          color: colors.bgSurface,
                          shape: const CircleBorder(),
                          elevation: 6,
                          shadowColor: const Color(0x55061833),
                          child: InkWell(
                            key: const Key('back-to-top'),
                            customBorder: const CircleBorder(),
                            onTap: _toTop,
                            child: SizedBox(
                              width: 48,
                              height: 48,
                              child: CustomPaint(
                                painter: _RingPainter(
                                  progress: _progress,
                                  track: colors.borderDefault,
                                  fill: colors.action,
                                ),
                                child: Icon(
                                  Icons.arrow_upward_rounded,
                                  color: colors.textBrand,
                                  size: 22,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({required this.progress, required this.track, required this.fill});

  final double progress;
  final Color track;
  final Color fill;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final ring = rect.deflate(3);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..color = track;
    canvas.drawArc(ring, 0, math.pi * 2, false, base);
    if (progress <= 0) return;
    final done = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..color = fill;
    canvas.drawArc(ring, -math.pi / 2, math.pi * 2 * progress, false, done);
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress || old.track != track || old.fill != fill;
}
