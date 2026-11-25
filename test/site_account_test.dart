import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/chats/domain/entities/chat_conversation.dart';
import 'package:sudan_it_marketplace/features/chats/domain/entities/chat_message.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chats_list_screen.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/widgets/message_bubble.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_auth.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_detail_parts.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_terms.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

/// The chats, the account pages and the sign-in card follow sictm.net.

final _now = DateTime(2026, 11, 15, 10);

ChatConversation _chat(String id, String company, {String text = 'Hello', bool unread = false}) => ChatConversation(
      id: id,
      serviceRequestId: id,
      customerId: 'cust1',
      companyId: 'c-$id',
      customerName: 'Amna',
      companyName: company,
      serviceName: 'Network Setup',
      createdAt: _now,
      lastMessageText: text,
      lastMessageAt: _now,
      lastMessageSenderRole: ChatParticipantRole.company,
      customerLastReadAt: unread ? null : _now.add(const Duration(minutes: 1)),
    );

final _chats = [
  _chat('a', 'Nile Tech', text: 'Your router is ready', unread: true),
  _chat('b', 'Blue IT', text: 'Thanks'),
];

Widget _app(Widget home, {List overrides = const [], Locale locale = const Locale('en'), double scale = 1}) => ProviderScope(
      // ignore: argument_type_not_assignable
      overrides: overrides.cast(),
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: home,
      ),
    );

void main() {
  group('the chats', () {
    test('the search reads the company, the subject and the last message', () {
      List<String> ids(String q, {bool unread = false}) => siteNarrowChats(
            _chats,
            query: q,
            unreadOnly: unread,
            subjectOf: (c) => c.serviceName,
          ).map((c) => c.id).toList();
      expect(ids(''), ['a', 'b']);
      expect(ids('router'), ['a']);
      expect(ids('blue'), ['b']);
      expect(ids('network'), ['a', 'b']);
      expect(ids('', unread: true), ['a']);
    });

    testWidgets('the customer\'s list: search and «Unread» on top', (tester) async {
      await tester.pumpWidget(_app(
        const Scaffold(body: ChatsListScreen(role: ChatParticipantRole.customer)),
        overrides: [customerChatsStreamProvider.overrideWith((ref) => Stream.value(_chats))],
      ));
      await tester.pumpAndSettle();
      expect(find.text('Nile Tech'), findsOneWidget);
      expect(find.text('Blue IT'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('chats-unread')));
      await tester.pumpAndSettle();
      expect(find.text('Blue IT'), findsNothing);
      await tester.tap(find.byKey(const ValueKey('chats-all')));
      await tester.enterText(find.byType(TextField), 'zzz');
      await tester.pumpAndSettle();
      expect(find.text('No chats here.'), findsOneWidget);
    });

    testWidgets('the company\'s list keeps its own look (no search)', (tester) async {
      await tester.pumpWidget(_app(
        const Scaffold(body: ChatsListScreen(role: ChatParticipantRole.company, companyId: 'c1')),
        overrides: [companyChatsStreamProvider('c1').overrideWith((ref) => Stream.value(_chats))],
      ));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('chats-unread')), findsNothing);
    });

    testWidgets('✓ when sent, ✓✓ once the company read it', (tester) async {
      final message = ChatMessage(
        id: 'm1',
        senderId: 'cust1',
        senderRole: ChatParticipantRole.customer,
        senderName: 'Amna',
        text: 'Hi',
        createdAt: _now,
      );
      Future<String> tick(bool? read) async {
        await tester.pumpWidget(_app(Scaffold(
          body: MessageBubble(message: message, isMine: true, showSender: false, readByOther: read),
        )));
        final found = find.byKey(const ValueKey('message-tick'));
        return found.evaluate().isEmpty ? '' : tester.widget<Text>(found).data!;
      }

      expect(await tick(false), '✓');
      expect(await tick(true), '✓✓');
      expect(await tick(null), '');
    });
  });

  group('the terms', () {
    test('only a published version with text counts', () {
      expect(SiteTerms.fromData(null), isNull);
      expect(SiteTerms.fromData({'version': 0, 'textAr': 'x'}), isNull);
      expect(SiteTerms.fromData({'version': 2, 'textAr': ' ', 'textEn': ''}), isNull);
      final terms = SiteTerms.fromData({
        'version': 3,
        'textAr': 'النص',
        'textEn': '',
        'updatedAt': Timestamp.fromDate(DateTime(2026, 11, 1)),
      })!;
      expect(terms.version, 3);
      expect(terms.updatedAt, DateTime(2026, 11, 1));
      // An English reader gets the Arabic text while no English is written.
      expect(terms.textIn('en'), 'النص');
    });

    testWidgets('the page shows the version, the date and the text', (tester) async {
      await tester.pumpWidget(_app(
        const SiteTermsPage(),
        overrides: [
          siteTermsProvider.overrideWith((ref) => Stream.value(SiteTerms(
                version: 2,
                textAr: 'نص',
                textEn: 'Be kind.',
                updatedAt: DateTime(2026, 11, 1),
              ))),
        ],
      ));
      await tester.pumpAndSettle();
      expect(find.text('Terms and conditions'), findsOneWidget);
      expect(find.text('Version 2 · Last updated: 1 November 2026'), findsOneWidget);
      expect(find.text('Be kind.'), findsOneWidget);
    });

    testWidgets('nothing published: says so', (tester) async {
      await tester.pumpWidget(_app(
        const SiteTermsPage(),
        overrides: [siteTermsProvider.overrideWith((ref) => Stream.value(null))],
      ));
      await tester.pumpAndSettle();
      expect(find.text('The terms and conditions have not been published yet.'), findsOneWidget);
    });
  });

  group('the account pieces', () {
    testWidgets('rows: the label, the value at the end, pressed as a whole', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_app(Scaffold(
        body: SiteRows(children: [
          SiteRow(icon: Icons.settings_outlined, label: 'Settings', onTap: () => taps++),
          const SiteRow(label: 'Phone', muted: true, trailing: Text('+249 91 234 5678')),
        ]),
      )));
      await tester.tap(find.text('Settings'));
      expect(taps, 1);
      expect(find.text('+249 91 234 5678'), findsOneWidget);
    });

    for (final locale in const [Locale('en'), Locale('ar')]) {
      testWidgets('the sign-in card fits 320 px with large text (${locale.languageCode})', (tester) async {
        tester.view.physicalSize = const Size(320, 1600);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(_app(
          const Scaffold(
            body: SingleChildScrollView(
              child: SiteAuthCard(title: 'Sign in', subtitle: 'Welcome back.', children: [Text('form')]),
            ),
          ),
          locale: locale,
          scale: 1.6,
        ));
        expect(find.text('Sign in'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  });
}
