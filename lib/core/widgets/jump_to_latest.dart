import 'package:flutter/material.dart';

import '../localization/l10n_extension.dart';
import '../theme/app_colors.dart';

/// One message as the jump button sees it: its id, and whether the reader wrote it.
typedef ChatItem = ({String id, bool mine});

/// How many of [items] (oldest first) came after [previousLast] and were
/// written by the other person: what someone reading older messages has not
/// seen yet. Mirrors the site's freshFromOthers.
int freshFromOthers(List<ChatItem> items, String previousLast) {
  if (previousLast.isEmpty) return 0;
  final at = items.lastIndexWhere((m) => m.id == previousLast);
  if (at < 0) return 0;
  return items.skip(at + 1).where((m) => !m.mine).length;
}

/// The chat's "jump to the latest" button over a REVERSED message list
/// (offset 0 is the newest message). It shows once the reader has scrolled up
/// about a screen, with the number of messages that arrived meanwhile, and
/// takes them back down.
class JumpToLatest extends StatefulWidget {
  const JumpToLatest({super.key, required this.items, required this.child});

  /// The messages, oldest first.
  final List<ChatItem> items;
  final Widget child;

  @override
  State<JumpToLatest> createState() => _JumpToLatestState();
}

class _JumpToLatestState extends State<JumpToLatest> {
  ScrollPosition? _position;
  bool _away = false;
  int _unseen = 0;

  bool _isAway(ScrollMetrics m) => m.pixels > m.viewportDimension * 0.8;

  @override
  void didUpdateWidget(JumpToLatest old) {
    super.didUpdateWidget(old);
    final before = old.items.isEmpty ? '' : old.items.last.id;
    final now = widget.items.isEmpty ? '' : widget.items.last.id;
    if (now != before && _away) {
      final fresh = freshFromOthers(widget.items, before);
      if (fresh > 0) _unseen += fresh;
    }
  }

  bool _onScroll(ScrollNotification n) {
    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;
    final context = n.context;
    if (context != null) _position = Scrollable.maybeOf(context)?.position;
    final away = _isAway(n.metrics);
    final atNewest = n.metrics.pixels < 60;
    if (away != _away || (atNewest && _unseen > 0)) {
      setState(() {
        _away = away;
        if (atNewest) _unseen = 0;
      });
    }
    return false;
  }

  void _jump() {
    final position = _position;
    if (position == null || !position.hasPixels) return;
    if (MediaQuery.of(context).disableAnimations) {
      position.jumpTo(0);
    } else {
      position.animateTo(
        0,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
    }
    setState(() => _unseen = 0);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = context.l10n;
    final label = _unseen > 0
        ? l10n.jumpToLatestNew(_unseen)
        : l10n.jumpToLatest;
    return NotificationListener<ScrollNotification>(
      onNotification: _onScroll,
      child: Stack(
        children: [
          widget.child,
          PositionedDirectional(
            end: 12,
            bottom: 12,
            child: IgnorePointer(
              ignoring: !_away,
              child: AnimatedSlide(
                offset: _away ? Offset.zero : const Offset(0, 0.4),
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOutCubic,
                child: AnimatedOpacity(
                  opacity: _away ? 1 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: Semantics(
                    button: true,
                    label: label,
                    excludeSemantics: true,
                    child: Tooltip(
                      message: label,
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Material(
                            color: colors.bgSurface,
                            shape: CircleBorder(
                              side: BorderSide(color: colors.borderDefault),
                            ),
                            elevation: 5,
                            shadowColor: const Color(0x55061833),
                            child: InkWell(
                              key: const Key('jump-to-latest'),
                              customBorder: const CircleBorder(),
                              onTap: _jump,
                              child: SizedBox(
                                width: 44,
                                height: 44,
                                child: Icon(
                                  Icons.arrow_downward_rounded,
                                  color: colors.textBrand,
                                  size: 22,
                                ),
                              ),
                            ),
                          ),
                          if (_unseen > 0)
                            PositionedDirectional(
                              top: -6,
                              start: -6,
                              child: Container(
                                key: const Key('jump-to-latest-count'),
                                constraints: const BoxConstraints(minWidth: 22),
                                height: 22,
                                padding: const EdgeInsets.symmetric(horizontal: 6),
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: colors.action,
                                  borderRadius: BorderRadius.circular(11),
                                  border: Border.all(color: colors.bgSurface, width: 2),
                                ),
                                child: Text(
                                  _unseen > 99 ? '99+' : '$_unseen',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    height: 1,
                                  ),
                                ),
                              ),
                            ),
                        ],
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
