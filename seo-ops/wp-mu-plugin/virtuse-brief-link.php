<?php
/**
 * Plugin Name: Virtuse Brief link
 * Description: On WordPress stories that have a virtuse.com copy (listed in virtuse-story-canonical.json, see virtuse-story-canonical.php), shows a fixed bar at the top of the page: "Read the Brief on virtuse.com" linking to the story's virtuse.com page. Rollback: delete this file.
 * Version: 2.0
 *
 * Must-use plugin (wp-content/mu-plugins/). No database writes, front end only
 * (never in wp-admin). Printed from wp_footer, which every theme calls, then
 * moved to the top of <body> by a few lines of JS. The bar is position:fixed;
 * the script adds the bar's height as padding-top on <body> and pushes
 * elements that the theme pins to the top (fixed/sticky headers, absolute
 * menus, reading-progress bars) down by the same amount, including ones that
 * only become fixed while scrolling. If the WordPress admin bar is shown, the
 * bar sits below it. The canonical link is handled by virtuse-story-canonical.php
 * and is not touched here. Needs virtuse-story-canonical.php (for the map).
 *
 * Option B, not active (Ras decides): 301 the listed posts to virtuse.com.
 * add_action( 'template_redirect', function () {
 *     if ( is_singular( 'post' ) && function_exists( 'virtuse_story_canonical_map' ) ) {
 *         $map = virtuse_story_canonical_map();
 *         $id  = get_queried_object_id();
 *         if ( isset( $map[ $id ] ) ) { wp_redirect( $map[ $id ], 301 ); exit; }
 *     }
 * } );
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action(
	'wp_footer',
	function () {
		if ( is_admin() || is_customize_preview() || ! is_singular( 'post' ) || ! function_exists( 'virtuse_story_canonical_map' ) ) {
			return;
		}
		$map = virtuse_story_canonical_map();
		$id  = get_queried_object_id();
		if ( ! isset( $map[ $id ] ) ) {
			return;
		}
		$sk    = ( false !== strpos( $map[ $id ], '://virtuse.com/sk/' ) );
		$label = $sk ? 'Čítajte Brief na virtuse.com' : 'Read the Brief on virtuse.com';
		?>
<style id="vb-brief-bar-css">
#vb-brief-bar{position:fixed;left:0;right:0;top:0;z-index:2147483000;margin:0;padding:10px 16px;background:#08090a;border-bottom:1px solid rgba(255,255,255,.12);text-align:center;font:600 14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-sizing:border-box}
#vb-brief-bar a{color:#f7931a;text-decoration:none}
#vb-brief-bar a:hover,#vb-brief-bar a:focus{text-decoration:underline}
@media print{#vb-brief-bar{display:none}}
</style>
<div id="vb-brief-bar" role="complementary" aria-label="Virtuse Brief"><a href="<?php echo esc_url( $map[ $id ] ); ?>"><?php echo esc_html( $label ); ?> &rarr;</a></div>
<script id="vb-brief-bar-js">
(function () {
	var bar = document.getElementById('vb-brief-bar');
	if (!bar || !document.body) return;
	document.body.insertBefore(bar, document.body.firstChild);
	var padBase = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
	var SEL = 'header, nav, [class*="header"], [class*="navbar"], [class*="progress"], [id*="header"], [id*="masthead"]';
	var tracked = [];
	function pinnedTop(el) {
		if (el === bar || bar.contains(el) || el.id === 'wpadminbar' || (el.closest && el.closest('#wpadminbar'))) return false;
		var cs = getComputedStyle(el);
		if (cs.position !== 'fixed' && cs.position !== 'sticky' && cs.position !== 'absolute') return false;
		// absolute only when positioned against the page, not inside a positioned box
		if (cs.position === 'absolute' && el.offsetParent && el.offsetParent !== document.body && el.offsetParent !== document.documentElement) return false;
		return true;
	}
	function adminBar() {
		var ab = document.getElementById('wpadminbar');
		return ab && getComputedStyle(ab).position === 'fixed' ? ab.getBoundingClientRect().height : 0;
	}
	function collect() {
		Array.prototype.forEach.call(document.querySelectorAll('body > *, ' + SEL), function (el) {
			if (tracked.indexOf(el) < 0) tracked.push(el);
		});
	}
	function apply() {
		var ab = adminBar();
		bar.style.top = ab + 'px';
		var h = bar.offsetHeight;
		document.body.style.paddingTop = (padBase + h) + 'px';
		tracked.forEach(function (el) {
			if (!pinnedTop(el)) { if (el.hasAttribute('data-vb-top')) { el.style.removeProperty('top'); el.removeAttribute('data-vb-top'); } return; }
			if (!el.hasAttribute('data-vb-top')) {
				el.style.removeProperty('top');
				el.setAttribute('data-vb-top', getComputedStyle(el).top);
			}
			var t = parseFloat(el.getAttribute('data-vb-top'));
			if (isNaN(t) || t < -2 || t > ab + 2) return; // only things pinned to the very top
			el.style.setProperty('top', (t + h) + 'px', 'important');
		});
	}
	var queued = false;
	function later() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; apply(); }); } }
	collect(); apply();
	window.addEventListener('scroll', later, { passive: true });
	window.addEventListener('resize', later);
	window.addEventListener('load', function () { collect(); apply(); });
})();
</script>
		<?php
	},
	99
);
