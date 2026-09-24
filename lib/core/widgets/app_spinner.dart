import 'package:flutter/material.dart';

/// The one small circular progress indicator: inside buttons, app bar actions
/// and the full-area loading state. Colour defaults to the theme's.
class AppSpinner extends StatelessWidget {
  const AppSpinner({
    super.key,
    this.size = 18,
    this.strokeWidth = 2,
    this.color,
  });

  final double size;
  final double strokeWidth;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: strokeWidth,
        color: color,
        backgroundColor: Colors.transparent,
      ),
    );
  }
}
