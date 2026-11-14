import '../../../l10n/app_localizations.dart';
import '../domain/stock_reservation.dart';

/// The customer-facing text of a stock failure, in the language of [l10n].
String stockErrorMessage(
  AppLocalizations l10n,
  StockUnavailableException error,
) {
  return switch (error.issue) {
    StockIssue.noLongerAvailable => l10n.stockNoLongerAvailable,
    StockIssue.chooseAtLeastOne => l10n.stockChooseAtLeastOne,
    StockIssue.outOfStock => l10n.stockOutOfStock(error.productName),
    StockIssue.insufficient =>
      l10n.stockOnlyLeft(error.available, error.productName),
  };
}
