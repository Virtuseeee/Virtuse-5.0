/* Rule picker for the Brief's "what it means for BTC" lines (news/macro-copy.json).
   A rule matches when every condition it has holds (gte, gt, lte, lt); a rule
   with "else": true always matches. The first match wins. No value, no line.
   Shared by news.js (window.VBMacroRules) and macro-build/macro-rules.test.mjs. */
(function (root) {
  'use strict';
  function matches(rule, v) {
    if (rule['else']) return true;
    if (rule.gte != null && !(v >= rule.gte)) return false;
    if (rule.gt != null && !(v > rule.gt)) return false;
    if (rule.lte != null && !(v <= rule.lte)) return false;
    if (rule.lt != null && !(v < rule.lt)) return false;
    return true;
  }
  function pick(copy, metric, value, lang) {
    if (value == null || typeof value !== 'number' || isNaN(value)) return '';
    var rules = copy && copy.rules && copy.rules[metric];
    if (!rules) return '';
    for (var i = 0; i < rules.length; i++) {
      if (matches(rules[i], value)) return rules[i][lang] || rules[i].en || '';
    }
    return '';
  }
  var api = { pick: pick, matches: matches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VBMacroRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
