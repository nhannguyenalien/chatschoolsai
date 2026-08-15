import 'package:flutter/material.dart';

import '../../../shared/presentation/feature_overview.dart';
import '../../../core/localization/app_localizations.dart';

class LoyaltyScreen extends StatelessWidget {
  const LoyaltyScreen({super.key});

  @override
  Widget build(BuildContext context) => FeatureOverview(
    title: context.l10n.tr('nav_loyalty'),
    description: context.l10n.tr('loyalty_desc'),
    icon: Icons.redeem_rounded,
    items: [
      (
        Icons.people_alt_outlined,
        context.l10n.tr('members'),
        context.l10n.tr('members_desc'),
      ),
      (
        Icons.workspace_premium_outlined,
        context.l10n.tr('points_tiers'),
        context.l10n.tr('points_desc'),
      ),
      (
        Icons.card_giftcard_rounded,
        context.l10n.tr('rewards'),
        context.l10n.tr('rewards_desc'),
      ),
    ],
  );
}
