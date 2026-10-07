<?php
/**
 * Plugin Name: Virtuse remove old GTM
 * Description: Strips the old Google Tag Manager container GTM-M4C5VRD (only dead Universal Analytics tags, loaded with no cookie consent) from every blog page the theme prints. Without it the blog sets no _ga / _gid / _gat cookies. Rollback: delete this file.
 * Version: 1.0
 *
 * Must-use plugin: lives in wp-content/mu-plugins/. The theme (virtuse)
 * hardcodes the GTM snippet in its header; this buffers the front-end HTML
 * and removes only the <script> block and the <noscript><iframe> that carry
 * GTM-M4C5VRD. No database writes, admin / REST / feeds / AJAX untouched.
 * If the snippet is not found, the page is sent unchanged.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'VIRTUSE_OLD_GTM_ID', 'GTM-M4C5VRD' );

/**
 * Remove the old container's script and noscript blocks from an HTML page.
 *
 * @param string $html Full page HTML.
 * @return string
 */
function virtuse_remove_old_gtm( $html ) {
	if ( ! is_string( $html ) || false === strpos( $html, VIRTUSE_OLD_GTM_ID ) ) {
		return $html;
	}
	$id  = preg_quote( VIRTUSE_OLD_GTM_ID, '#' );
	$out = preg_replace(
		array(
			// Optional "<!-- Google Tag Manager -->" comment, then a <script> whose body contains the ID.
			'#(?:<!--\s*Google Tag Manager\s*-->\s*)?<script\b[^>]*>(?:(?!</script>).)*?' . $id . '(?:(?!</script>).)*?</script>(?:\s*<!--\s*End Google Tag Manager\s*-->)?#is',
			// <noscript><iframe src=".../ns.html?id=GTM-...">...</iframe></noscript>
			'#(?:<!--\s*Google Tag Manager \(noscript\)\s*-->\s*)?<noscript>\s*<iframe\b[^>]*' . $id . '[^>]*>\s*</iframe>\s*</noscript>(?:\s*<!--\s*End Google Tag Manager \(noscript\)\s*-->)?#is',
		),
		'',
		$html
	);
	// preg_replace returns null on a regex error (e.g. backtrack limit): keep the page.
	return is_string( $out ) ? $out : $html;
}

add_action(
	'template_redirect',
	function () {
		if ( is_admin() || wp_doing_ajax() || is_feed() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}
		ob_start( 'virtuse_remove_old_gtm' );
	},
	0
);
