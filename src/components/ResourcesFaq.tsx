/**
 * ResourcesFaq — the "Common questions" FAQ on /resources and /es/resources (#709).
 *
 * Server component, handed to the client ResourcesContent as its `faq` prop, so
 * the FAQ text and FAQPage JSON-LD are in the server HTML with no client JS.
 *
 * SOURCES for the answers (i18n keys `resources.faq.*`), all fetched 2026-09-28.
 * Every answer is general; none makes a claim about eligibility, ID, income or
 * immigration status for any specific place.
 *   a1 SNAP: https://cdhs.colorado.gov/snap — "Apply online through the Colorado
 *      PEAK website"; MyCOBenefits app; paper application returned to "your county
 *      human services office"; "Each county's human services department is
 *      responsible for determining eligibility"; eligibility "based on income,
 *      resources and household size". Phone help: https://hungerfreecolorado.org/
 *      service/food-resource-hotline/ (855-855-4626, "assists with SNAP
 *      applications by phone"). NOT verified: colorado.gov/PEAK itself (a
 *      JavaScript shell that returns no text) and the Pueblo County DHS office
 *      page (county.pueblo.org answered 403/404), so the answer names no office
 *      address or phone; the SNAP card above it already links PEAK.
 *   a2 WIC: https://www.coloradowic.gov/eligibility/apply — contact a clinic to
 *      schedule, or the online form (coloradowicsignup.com), "a WIC staff member
 *      will contact you within 10 days"; "we can help you identify which
 *      documents to bring". Clinic finder: https://www.coloradowic.gov/find-wic-clinic
 *   a3 Pantry what-to-bring: no official source states one rule for every pantry.
 *      https://www.foodbankrockies.org/get-help/ tells people to open each
 *      location for "days and hours, programs offered, and any requirements to
 *      receiving food", i.e. requirements are set per location; hotline as above
 *      for pantry referrals. The answer therefore says only "it depends, check,
 *      call ahead".
 *   a4 Emergency food: https://www.211colorado.org/food-assistance/ — dial 2-1-1
 *      or (866) 760-6489, text ZIP to 898-211 (the page gives no hours, so none
 *      are stated for 2-1-1); Food Resource Hotline hours (Mon-Thu 8:30-4:30,
 *      Fri 8-noon) and "food pantries, free meal sites" from the hotline page above.
 * Re-check these when editing: phone hours drift.
 */

import { t, type Locale } from "@/lib/i18n";
import FaqSection, { faqItemsFor } from "@/components/FaqSection";

export default function ResourcesFaq({ locale }: { locale: Locale }) {
  return (
    <FaqSection
      id="resources-faq-heading"
      heading={t("resources.faq.heading", locale)}
      items={faqItemsFor("resources.faq", 4, locale)}
      locale={locale}
    />
  );
}
