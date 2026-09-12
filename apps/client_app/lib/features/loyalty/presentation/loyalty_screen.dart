import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_localizations.dart';
import '../data/loyalty_models.dart';
import '../data/reward_world_models.dart';
import 'loyalty_controller.dart';

class LoyaltyScreen extends ConsumerStatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  ConsumerState<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends ConsumerState<LoyaltyScreen> {
  final _customerRef = TextEditingController();
  final _joining = <String>{};
  final _claiming = <String>{};
  List<CustomerReward>? _rewards;
  LoyaltyAccount? _account;
  bool _loadingRewards = false;
  String? _rewardsError;

  @override
  void dispose() {
    _customerRef.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final campaigns = ref.watch(rewardCampaignsProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.tr('nav_loyalty'),
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 6),
              Text(
                context.l10n.tr('loyalty_desc'),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(rewardCampaignsProvider.future),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
              children: [
                _CustomerCard(
                  controller: _customerRef,
                  loading: _loadingRewards,
                  onLookup: _lookup,
                  onAddSale: _openSaleDialog,
                  onRedeem: _openRedeemDialog,
                ),
                if (_account != null) ...[
                  const SizedBox(height: 10),
                  _AccountBalanceCard(account: _account!),
                ],
                if (_rewardsError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(
                      _rewardsError!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                if (_rewards != null) ...[
                  const SizedBox(height: 10),
                  ..._rewards!.map(
                    (reward) => _RewardTile(
                      reward: reward,
                      busy: _claiming.contains(reward.id),
                      onClaim: () => _claim(reward),
                    ),
                  ),
                  if (_rewards!.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        context.l10n.tr('reward_world_no_prizes'),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                ],
                const SizedBox(height: 24),
                Text(
                  context.l10n.tr('reward_world_title'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  context.l10n.tr('reward_world_subtitle'),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 12),
                campaigns.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (error, _) => _InlineError(
                    message: error.toString(),
                    onRetry: () => ref.invalidate(rewardCampaignsProvider),
                  ),
                  data: (list) => list.isEmpty
                      ? _EmptyCampaigns(
                          message: context.l10n.tr('no_campaigns'),
                        )
                      : Column(
                          children: list
                              .map(
                                (campaign) => _CampaignCard(
                                  campaign: campaign,
                                  busy: _joining.contains(campaign.id),
                                  onJoin: () => _join(campaign),
                                  onSpin: () => _spin(campaign),
                                ),
                              )
                              .toList(),
                        ),
                ),
                const SizedBox(height: 24),
                const _ProgramSection(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _join(RewardCampaign campaign) async {
    setState(() => _joining.add(campaign.id));
    try {
      await ref.read(loyaltyRepositoryProvider).joinCampaign(campaign.id);
      ref.invalidate(rewardCampaignsProvider);
    } catch (error) {
      if (mounted) _showError(error.toString());
    } finally {
      if (mounted) setState(() => _joining.remove(campaign.id));
    }
  }

  Future<void> _spin(RewardCampaign campaign) async {
    final customerRef = _customerRef.text.trim();
    if (customerRef.isEmpty) {
      _showError(context.l10n.tr('customer_ref_required'));
      return;
    }
    final result = await showDialog<SpinResult>(
      context: context,
      barrierDismissible: false,
      builder: (_) =>
          _SpinWheelDialog(campaign: campaign, customerRef: customerRef),
    );
    if (result != null) await _lookup();
  }

  Future<void> _lookup() async {
    final customerRef = _customerRef.text.trim();
    if (customerRef.isEmpty) {
      _showError(context.l10n.tr('customer_ref_required'));
      return;
    }
    setState(() {
      _loadingRewards = true;
      _rewardsError = null;
    });
    final repository = ref.read(loyaltyRepositoryProvider);
    try {
      final rewards = await repository.fetchRewards(customerRef);
      if (mounted) setState(() => _rewards = rewards);
    } catch (error) {
      if (mounted) setState(() => _rewardsError = error.toString());
    } finally {
      if (mounted) setState(() => _loadingRewards = false);
    }
    // A brand-new customer has no ledger yet; that 404 is expected, so it
    // stays silent instead of surfacing next to the rewards lookup error.
    try {
      final account = await repository.fetchAccount(customerRef);
      if (mounted) setState(() => _account = account);
    } catch (_) {
      if (mounted) setState(() => _account = null);
    }
  }

  Future<void> _openSaleDialog() async {
    final customerRef = _customerRef.text.trim();
    if (customerRef.isEmpty) {
      _showError(context.l10n.tr('customer_ref_required'));
      return;
    }
    final result = await showDialog<SaleResult>(
      context: context,
      builder: (_) => _SaleEntryDialog(customerRef: customerRef),
    );
    if (!mounted) return;
    if (result != null) {
      _showError(
        result.replayed
            ? context.l10n.tr('sale_replayed')
            : '${context.l10n.tr('sale_recorded')} ${result.pointsDelta}'
                  '${result.spinsGranted > 0 ? ' · ${context.l10n.tr('spins_granted')} ${result.spinsGranted}' : ''}',
      );
      await _lookup();
    }
  }

  Future<void> _openRedeemDialog() async {
    final customerRef = _customerRef.text.trim();
    if (customerRef.isEmpty) {
      _showError(context.l10n.tr('customer_ref_required'));
      return;
    }
    final result = await showDialog<RedeemResult>(
      context: context,
      builder: (_) => _RedeemDialog(customerRef: customerRef),
    );
    if (!mounted) return;
    if (result != null) {
      _showError(
        result.replayed
            ? context.l10n.tr('redeem_replayed')
            : '${context.l10n.tr('redeem_recorded')} ${result.balance ?? '-'}',
      );
      await _lookup();
    }
  }

  Future<void> _claim(CustomerReward reward) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.l10n.tr('confirm_claim_title')),
        content: Text(reward.prizeName),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(context.l10n.tr('cancel_alt')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(context.l10n.tr('confirm')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _claiming.add(reward.id));
    try {
      await ref.read(loyaltyRepositoryProvider).claimReward(reward.id);
      await _lookup();
    } catch (error) {
      if (mounted) _showError(error.toString());
    } finally {
      if (mounted) setState(() => _claiming.remove(reward.id));
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({
    required this.controller,
    required this.loading,
    required this.onLookup,
    required this.onAddSale,
    required this.onRedeem,
  });

  final TextEditingController controller;
  final bool loading;
  final VoidCallback onLookup;
  final VoidCallback onAddSale;
  final VoidCallback onRedeem;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  keyboardType: TextInputType.phone,
                  enabled: !loading,
                  decoration: InputDecoration(
                    labelText: context.l10n.tr('customer_ref_label'),
                    prefixIcon: const Icon(Icons.person_search_rounded),
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  onSubmitted: loading ? null : (_) => onLookup(),
                ),
              ),
              const SizedBox(width: 10),
              FilledButton.tonal(
                onPressed: loading ? null : onLookup,
                child: loading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(context.l10n.tr('lookup')),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onAddSale,
                  icon: const Icon(Icons.add_card_rounded),
                  label: Text(context.l10n.tr('add_sale')),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onRedeem,
                  icon: const Icon(Icons.remove_circle_outline_rounded),
                  label: Text(context.l10n.tr('redeem_points')),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _AccountBalanceCard extends StatelessWidget {
  const _AccountBalanceCard({required this.account});
  final LoyaltyAccount account;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  (account.customerName?.trim().isNotEmpty ?? false)
                      ? account.customerName!
                      : account.customerRef,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Text(
                '${account.balance} ${context.l10n.tr('points_unit')}',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          if (account.entries.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Divider(height: 1),
            ...account.entries
                .take(5)
                .map(
                  (entry) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            entry.sourceRef,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ),
                        Text(
                          '${entry.pointsDelta >= 0 ? '+' : ''}${entry.pointsDelta}',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: entry.pointsDelta >= 0
                                ? Colors.green
                                : Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
          ],
        ],
      ),
    ),
  );
}

class _SaleEntryDialog extends ConsumerStatefulWidget {
  const _SaleEntryDialog({required this.customerRef});
  final String customerRef;

  @override
  ConsumerState<_SaleEntryDialog> createState() => _SaleEntryDialogState();
}

class _SaleEntryDialogState extends ConsumerState<_SaleEntryDialog> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _receipt = TextEditingController();
  final _amount = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _receipt.dispose();
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(context.l10n.tr('add_sale')),
    content: Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _name,
              decoration: InputDecoration(
                labelText: context.l10n.tr('customer_name_optional'),
              ),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _receipt,
              decoration: InputDecoration(
                labelText: context.l10n.tr('receipt_ref_label'),
              ),
              validator: (value) => (value?.trim().isEmpty ?? true)
                  ? context.l10n.tr('required')
                  : null,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: context.l10n.tr('amount_vnd_label'),
              ),
              validator: (value) {
                final amount = int.tryParse(value?.trim() ?? '');
                return amount == null || amount <= 0
                    ? context.l10n.tr('required')
                    : null;
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: _busy ? null : () => Navigator.pop(context),
        child: Text(context.l10n.tr('cancel_alt')),
      ),
      FilledButton(
        onPressed: _busy ? null : _submit,
        child: _busy
            ? const SizedBox.square(
                dimension: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(context.l10n.tr('confirm')),
      ),
    ],
  );

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(loyaltyRepositoryProvider)
          .recordSale(
            customerRef: widget.customerRef,
            receiptRef: _receipt.text.trim(),
            amountMinor: int.parse(_amount.text.trim()),
            customerName: _name.text.trim(),
          );
      if (mounted) Navigator.pop(context, result);
    } catch (error) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = error.toString();
        });
      }
    }
  }
}

class _RedeemDialog extends ConsumerStatefulWidget {
  const _RedeemDialog({required this.customerRef});
  final String customerRef;

  @override
  ConsumerState<_RedeemDialog> createState() => _RedeemDialogState();
}

class _RedeemDialogState extends ConsumerState<_RedeemDialog> {
  final _formKey = GlobalKey<FormState>();
  final _redemptionRef = TextEditingController();
  final _points = TextEditingController();
  final _note = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _redemptionRef.dispose();
    _points.dispose();
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(context.l10n.tr('redeem_points')),
    content: Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _redemptionRef,
              decoration: InputDecoration(
                labelText: context.l10n.tr('redemption_ref_label'),
              ),
              validator: (value) => (value?.trim().isEmpty ?? true)
                  ? context.l10n.tr('required')
                  : null,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _points,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: context.l10n.tr('points_to_redeem_label'),
              ),
              validator: (value) {
                final points = int.tryParse(value?.trim() ?? '');
                return points == null || points <= 0
                    ? context.l10n.tr('required')
                    : null;
              },
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _note,
              decoration: InputDecoration(
                labelText: context.l10n.tr('note_optional'),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: _busy ? null : () => Navigator.pop(context),
        child: Text(context.l10n.tr('cancel_alt')),
      ),
      FilledButton(
        onPressed: _busy ? null : _submit,
        child: _busy
            ? const SizedBox.square(
                dimension: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(context.l10n.tr('confirm')),
      ),
    ],
  );

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(loyaltyRepositoryProvider)
          .redeemPoints(
            customerRef: widget.customerRef,
            redemptionRef: _redemptionRef.text.trim(),
            points: int.parse(_points.text.trim()),
            note: _note.text.trim(),
          );
      if (mounted) Navigator.pop(context, result);
    } catch (error) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = error.toString();
        });
      }
    }
  }
}

class _ProgramSection extends ConsumerStatefulWidget {
  const _ProgramSection();

  @override
  ConsumerState<_ProgramSection> createState() => _ProgramSectionState();
}

class _ProgramSectionState extends ConsumerState<_ProgramSection> {
  final _spendPerPoint = TextEditingController(text: '10000');
  final _pointsPerStep = TextEditingController(text: '1');
  bool _saving = false;
  int? _loadedVersion;

  @override
  void dispose() {
    _spendPerPoint.dispose();
    _pointsPerStep.dispose();
    super.dispose();
  }

  void _syncFromProgram(LoyaltyProgram? program) {
    if (program == null || program.version == _loadedVersion) return;
    _loadedVersion = program.version;
    _spendPerPoint.text = '${program.spendPerPointMinor}';
    _pointsPerStep.text = '${program.pointsPerStep}';
  }

  @override
  Widget build(BuildContext context) {
    final program = ref.watch(loyaltyProgramProvider);
    program.whenData(_syncFromProgram);
    return Card(
      child: ExpansionTile(
        leading: const Icon(Icons.settings_suggest_outlined),
        title: Text(context.l10n.tr('program_rules_title')),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          program.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, _) => Text(error.toString()),
            data: (value) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  value == null
                      ? context.l10n.tr('no_program_yet')
                      : context.l10n.tr('program_active_hint'),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _spendPerPoint,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: context.l10n.tr('spend_per_point_label'),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _pointsPerStep,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: context.l10n.tr('points_per_step_label'),
                  ),
                ),
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(context.l10n.tr('save')),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    final spend = int.tryParse(_spendPerPoint.text.trim());
    final points = int.tryParse(_pointsPerStep.text.trim());
    if (spend == null || spend <= 0 || points == null || points <= 0) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(context.l10n.tr('required'))));
      return;
    }
    setState(() => _saving = true);
    try {
      await ref
          .read(loyaltyRepositoryProvider)
          .saveProgram(spendPerPointMinor: spend, pointsPerStep: points);
      ref.invalidate(loyaltyProgramProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.tr('updated_success'))),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _RewardTile extends StatelessWidget {
  const _RewardTile({
    required this.reward,
    required this.busy,
    required this.onClaim,
  });

  final CustomerReward reward;
  final bool busy;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: const CircleAvatar(child: Icon(Icons.card_giftcard_rounded)),
      title: Text(reward.prizeName),
      subtitle: reward.spunAt != null
          ? Text(_formatDate(reward.spunAt!))
          : null,
      trailing: reward.claimed
          ? Chip(label: Text(context.l10n.tr('claimed')))
          : FilledButton(
              onPressed: busy ? null : onClaim,
              child: busy
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(context.l10n.tr('mark_claimed')),
            ),
    ),
  );

  String _formatDate(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} '
      '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}

class _CampaignCard extends StatelessWidget {
  const _CampaignCard({
    required this.campaign,
    required this.busy,
    required this.onJoin,
    required this.onSpin,
  });

  final RewardCampaign campaign;
  final bool busy;
  final VoidCallback onJoin;
  final VoidCallback onSpin;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(campaign.name, style: Theme.of(context).textTheme.titleMedium),
          if ((campaign.description ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              campaign.description!,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
          if (campaign.prizes.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: campaign.prizes
                  .map((prize) => Chip(label: Text(prize.name)))
                  .toList(),
            ),
          ],
          const SizedBox(height: 12),
          if (campaign.joined)
            FilledButton.icon(
              onPressed: onSpin,
              icon: const Icon(Icons.casino_rounded),
              label: Text(context.l10n.tr('spin_now')),
            )
          else
            OutlinedButton(
              onPressed: busy ? null : onJoin,
              child: busy
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(context.l10n.tr('join_campaign')),
            ),
        ],
      ),
    ),
  );
}

class _EmptyCampaigns extends StatelessWidget {
  const _EmptyCampaigns({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(Icons.card_giftcard_outlined, size: 40),
          const SizedBox(height: 10),
          Text(message, textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: Text(context.l10n.tr('retry')),
          ),
        ],
      ),
    ),
  );
}

class _SpinWheelDialog extends ConsumerStatefulWidget {
  const _SpinWheelDialog({required this.campaign, required this.customerRef});

  final RewardCampaign campaign;
  final String customerRef;

  @override
  ConsumerState<_SpinWheelDialog> createState() => _SpinWheelDialogState();
}

class _SpinWheelDialogState extends ConsumerState<_SpinWheelDialog>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4200),
  );
  Animation<double> _rotation = const AlwaysStoppedAnimation(0);
  SpinResult? _result;
  String? _error;

  @override
  void initState() {
    super.initState();
    _requestSpin();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _requestSpin() async {
    try {
      final result = await ref
          .read(loyaltyRepositoryProvider)
          .spin(
            campaignId: widget.campaign.id,
            customerRef: widget.customerRef,
          );
      if (!mounted) return;
      final prizes = widget.campaign.prizes;
      var index = prizes.indexWhere((prize) => prize.id == result.prizeId);
      if (index < 0) {
        index = prizes.indexWhere((prize) => prize.name == result.prizeName);
      }
      if (index < 0) index = 0;
      final sector = 2 * pi / max(prizes.length, 1);
      final target = 2 * pi * 6 - (index + 0.5) * sector;
      setState(() {
        _result = result;
        _rotation = Tween<double>(begin: 0, end: target).animate(
          CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
        );
      });
      await _controller.forward();
      if (mounted) setState(() {});
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.campaign.name),
    content: SizedBox(
      width: 280,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 220,
            height: 220,
            child: Stack(
              alignment: Alignment.center,
              children: [
                AnimatedBuilder(
                  animation: _rotation,
                  builder: (context, child) =>
                      Transform.rotate(angle: _rotation.value, child: child),
                  child: CustomPaint(
                    size: const Size(220, 220),
                    painter: _WheelPainter(prizes: widget.campaign.prizes),
                  ),
                ),
                const Positioned(
                  top: -4,
                  child: Icon(
                    Icons.arrow_drop_down_rounded,
                    size: 44,
                    color: Colors.redAccent,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Text(
            _statusText(context),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: !_controller.isAnimating
            ? () => Navigator.pop(context, _result)
            : null,
        child: Text(context.l10n.tr('close')),
      ),
    ],
  );

  String _statusText(BuildContext context) {
    if (_error != null) return _error!;
    if (_result == null) return context.l10n.tr('spin_pending');
    if (_controller.isAnimating) return context.l10n.tr('spin_spinning');
    return _result!.won
        ? '${context.l10n.tr('spin_won')}: ${_result!.prizeName}'
        : context.l10n.tr('spin_lost');
  }
}

class _WheelPainter extends CustomPainter {
  const _WheelPainter({required this.prizes});

  final List<RewardPrize> prizes;

  static const _colors = [
    Color(0xFF206BC4),
    Color(0xFFF76707),
    Color(0xFF2FB344),
    Color(0xFFAE3EC9),
    Color(0xFFD63939),
    Color(0xFF0CA678),
    Color(0xFFF59F00),
    Color(0xFF4263EB),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.width / 2;
    final count = prizes.isEmpty ? 1 : prizes.length;
    final sector = 2 * pi / count;

    for (var i = 0; i < count; i++) {
      final paint = Paint()..color = _colors[i % _colors.length];
      final start = -pi / 2 + i * sector;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        start,
        sector,
        true,
        paint,
      );
    }
    canvas.drawCircle(
      center,
      radius - 2,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..color = Colors.white,
    );

    for (var i = 0; i < prizes.length; i++) {
      final angle = -pi / 2 + (i + 0.5) * sector;
      final labelRadius = radius * 0.62;
      final offset = center + Offset(cos(angle), sin(angle)) * labelRadius;
      final painter = TextPainter(
        text: TextSpan(
          text: prizes[i].name,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
        maxLines: 2,
        ellipsis: '…',
      )..layout(maxWidth: radius * 0.75);
      canvas.save();
      canvas.translate(offset.dx, offset.dy);
      canvas.rotate(angle + pi / 2);
      painter.paint(canvas, Offset(-painter.width / 2, -painter.height / 2));
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _WheelPainter oldDelegate) =>
      oldDelegate.prizes != prizes;
}
