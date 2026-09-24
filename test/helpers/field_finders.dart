import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/widgets/app_widgets.dart';

/// The input of the [AppTextField] whose label above the field is [label].
///
/// Labels sit above the field in the design system, so they are no longer
/// descendants of the `TextFormField` and `find.widgetWithText` cannot match.
Finder fieldWithLabel(String label) => find.descendant(
      of: find.byWidgetPredicate(
        (widget) => widget is AppTextField && widget.label == label,
      ),
      matching: find.byType(TextFormField),
    );
