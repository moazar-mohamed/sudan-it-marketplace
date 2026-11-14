import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'locale_controller.dart';

/// A form field keeps the error text it computed when it was validated, so a
/// message already on screen would stay in the old language after the user
/// switches language. This re-runs the validators of the fields that are
/// showing an error, right after the language changes, so their messages are
/// re-written in the new language. Fields without an error are left alone.
///
/// Placed once above the whole app, so every form is covered.
class FormLocaleRefresher extends ConsumerWidget {
  const FormLocaleRefresher({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(localeControllerProvider, (previous, next) {
      if (previous == next) return;
      // After the frame that rebuilds the screens in the new language, so the
      // validators (which read the translations) already speak it.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        void visit(Element element) {
          if (element is StatefulElement) {
            final state = element.state;
            if (state is FormFieldState && state.hasError) state.validate();
          }
          element.visitChildren(visit);
        }

        (context as Element).visitChildren(visit);
      });
    });
    return child;
  }
}
