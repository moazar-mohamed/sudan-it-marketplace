import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../companies/domain/entities/payment_account.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../company_admin_actions.dart';
import '../widgets/admin_section_card.dart';

/// Lets a company manage the accounts its customers transfer manual payments
/// to. The customer sees exactly this list on the payment screen of an order
/// for the company.
class PaymentAccountsScreen extends ConsumerStatefulWidget {
  const PaymentAccountsScreen({super.key, required this.companyId});

  final String companyId;

  @override
  ConsumerState<PaymentAccountsScreen> createState() =>
      _PaymentAccountsScreenState();
}

class _PaymentAccountsScreenState extends ConsumerState<PaymentAccountsScreen> {
  bool _isSaving = false;

  Future<void> _save(
    List<PaymentAccount> accounts, {
    required String successMessage,
  }) async {
    if (_isSaving) {
      return;
    }
    setState(() => _isSaving = true);
    final error = await ref
        .read(companyAdminActionsProvider)
        .updatePaymentAccounts(widget.companyId, accounts);
    if (!mounted) {
      return;
    }
    setState(() => _isSaving = false);
    showAppSnackBar(
      context,
      error ?? successMessage,
      tone: error == null ? AppTone.success : AppTone.error,
    );
  }

  Future<void> _addOrEdit(
    List<PaymentAccount> accounts, {
    int? index,
  }) async {
    final saved = await showDialog<PaymentAccount>(
      context: context,
      builder: (_) => _PaymentAccountDialog(
        initial: index == null ? null : accounts[index],
      ),
    );
    if (saved == null || !mounted) {
      return;
    }
    final updated = [...accounts];
    if (index == null) {
      updated.add(saved);
    } else {
      updated[index] = saved;
    }
    await _save(updated, successMessage: context.l10n.paymentAccountSaved);
  }

  Future<void> _remove(List<PaymentAccount> accounts, int index) async {
    final l10n = context.l10n;
    final confirmed = await showConfirmationDialog(
      context,
      title: l10n.paymentAccountRemoveTitle,
      body: l10n.paymentAccountRemoveBody,
      confirmLabel: l10n.commonRemove,
      destructive: true,
    );
    if (!confirmed || !mounted) {
      return;
    }
    final updated = [...accounts]..removeAt(index);
    await _save(updated, successMessage: l10n.paymentAccountRemoved);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final companyAsync = ref.watch(companyStreamProvider(widget.companyId));
    final accounts = companyAsync.asData?.value?.paymentAccounts ?? const [];
    final atLimit = accounts.length >= PaymentAccount.maxPerCompany;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.paymentAccountsManage)),
      body: SafeArea(
        top: false,
        child: companyAsync.when(
          loading: () => const AppLoadingState(),
          error: (_, _) => AppErrorState(
            message: l10n.adminCompanyLoadFailed,
            onRetry: () =>
                ref.invalidate(companyStreamProvider(widget.companyId)),
          ),
          data: (_) => AppCenteredList(
            bottomPadding: AppSpacing.s32,
            children: [
              AppBanner(tone: AppTone.info, message: l10n.paymentAccountsIntro),
              const SizedBox(height: AppSpacing.s16),
              if (accounts.isEmpty)
                AppEmptyState(
                  icon: Icons.account_balance_outlined,
                  message: l10n.paymentAccountsEmpty,
                ),
              for (var i = 0; i < accounts.length; i++) ...[
                _AccountCard(
                  account: accounts[i],
                  enabled: !_isSaving,
                  onEdit: () => _addOrEdit(accounts, index: i),
                  onRemove: () => _remove(accounts, i),
                ),
                const SizedBox(height: AppSpacing.s12),
              ],
              const SizedBox(height: AppSpacing.s4),
              AppButton.primary(
                icon: Icons.add,
                loading: _isSaving,
                label: l10n.paymentAccountAdd,
                expand: true,
                onPressed: atLimit ? null : () => _addOrEdit(accounts),
              ),
              if (atLimit) ...[
                const SizedBox(height: AppSpacing.s8),
                Text(
                  l10n.paymentAccountLimit(PaymentAccount.maxPerCompany),
                  textAlign: TextAlign.center,
                  style: AppTextStyles.caption
                      .copyWith(color: AppColors.textSecondary),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountCard extends StatelessWidget {
  const _AccountCard({
    required this.account,
    required this.enabled,
    required this.onEdit,
    required this.onRemove,
  });

  final PaymentAccount account;
  final bool enabled;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AdminSectionCard(
      title: account.bankName,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: l10n.commonEdit,
            onPressed: enabled ? onEdit : null,
            icon: const Icon(Icons.edit_outlined, size: AppSize.iconMd),
          ),
          IconButton(
            tooltip: l10n.commonRemove,
            onPressed: enabled ? onRemove : null,
            icon: const Icon(
              Icons.delete_outline,
              size: AppSize.iconMd,
              color: AppColors.errorText,
            ),
          ),
        ],
      ),
      children: [
        if (account.accountName.isNotEmpty)
          AdminInfoRow(
            label: l10n.paymentAccountName,
            value: account.accountName,
          ),
        AdminInfoRow(
          label: l10n.paymentAccountMban,
          value: account.accountNumber,
          emphasize: true,
        ),
        if (account.phoneNumber.isNotEmpty)
          AdminInfoRow(
            label: l10n.paymentPhoneIdentifier,
            value: account.phoneNumber,
          ),
      ],
    );
  }
}

class _PaymentAccountDialog extends StatefulWidget {
  const _PaymentAccountDialog({this.initial});

  final PaymentAccount? initial;

  @override
  State<_PaymentAccountDialog> createState() => _PaymentAccountDialogState();
}

class _PaymentAccountDialogState extends State<_PaymentAccountDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _bank;
  late final TextEditingController _holder;
  late final TextEditingController _number;
  late final TextEditingController _phone;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    _bank = TextEditingController(text: initial?.bankName ?? '');
    _holder = TextEditingController(text: initial?.accountName ?? '');
    _number = TextEditingController(text: initial?.accountNumber ?? '');
    _phone = TextEditingController(text: initial?.phoneNumber ?? '');
  }

  @override
  void dispose() {
    _bank.dispose();
    _holder.dispose();
    _number.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    Navigator.of(context).pop(
      PaymentAccount(
        bankName: _bank.text.trim(),
        accountName: _holder.text.trim(),
        accountNumber: _number.text.trim(),
        phoneNumber: _phone.text.trim(),
      ),
    );
  }

  String? _required(String? value, String message) =>
      (value?.trim().isEmpty ?? true) ? message : null;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(
        widget.initial == null ? l10n.paymentAccountAdd : l10n.paymentAccountEdit,
      ),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppTextField(
                label: l10n.paymentAccountBankName,
                controller: _bank,
                maxLength: 80,
                textCapitalization: TextCapitalization.words,
                validator: (v) => _required(v, l10n.paymentAccountBankRequired),
              ),
              const SizedBox(height: AppSpacing.s12),
              AppTextField(
                label: l10n.paymentAccountName,
                controller: _holder,
                maxLength: 120,
                textCapitalization: TextCapitalization.words,
                validator: (v) =>
                    _required(v, l10n.paymentAccountHolderRequired),
              ),
              const SizedBox(height: AppSpacing.s12),
              AppTextField(
                label: l10n.paymentAccountMban,
                controller: _number,
                maxLength: 40,
                validator: (v) =>
                    _required(v, l10n.paymentAccountNumberRequired),
              ),
              const SizedBox(height: AppSpacing.s12),
              AppTextField(
                label: l10n.paymentAccountPhoneOptional,
                controller: _phone,
                maxLength: 30,
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
                ],
              ),
            ],
          ),
        ),
      ),
      actions: [
        AppButton.text(
          label: l10n.commonCancel,
          onPressed: () => Navigator.of(context).pop(),
        ),
        AppButton.primary(
          label: l10n.commonSave,
          size: AppButtonSize.medium,
          onPressed: _submit,
        ),
      ],
    );
  }
}
