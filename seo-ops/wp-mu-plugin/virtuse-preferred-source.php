<?php
/**
 * Plugin Name: Virtuse preferred source on Google
 * Description: Under every blog post: "Add Virtuse as a preferred source on Google" (SK: "Pridajte si Virtuse ako preferovaný zdroj na Google"), a link to Google's preferred-source page for this site. Rollback: delete this file.
 * Version: 1.0
 *
 * NOT DEPLOYED (2026-10-21): prepared for Ras; blog.virtuse.com has no staging.
 * Must-use plugin (wp-content/mu-plugins/), front end only, no database writes.
 *
 * Only the deeplink, no Google script: the blog has no cookie banner, and the
 * Google button (news.google.com/swg/js/v1/publisher.js) may load only after
 * consent (handover rule; virtuse.com does this in preferred-source.js). If the
 * blog gets a consent banner, load publisher.js after consent and add
 * <div google-add-preferred-source-btn data-theme="light" data-lang="sk|en"></div>.
 * https://developers.google.com/search/docs/appearance/preferred-sources
 *
 * Domain: blog.virtuse.com (subdomains are eligible). Note that the posts that
 * have a virtuse.com story copy point their canonical there
 * (virtuse-story-canonical.php), so Google shows virtuse.com in Top Stories;
 * set VIRTUSE_PREF_SOURCE_DOMAIN to 'virtuse.com' if Ras prefers one source.
 *
 * Clicks push dataLayer {event: 'preferred_source_click', link_type: 'deeplink',
 * page_lang} like virtuse.com; the blog loads no GTM today, so nothing is sent.
 * Styles are inline style attributes (LiteSpeed strips <style> blocks, see
 * virtuse-brief-link.php).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'VIRTUSE_PREF_SOURCE_DOMAIN' ) ) {
	define( 'VIRTUSE_PREF_SOURCE_DOMAIN', 'blog.virtuse.com' );
}

add_filter(
	'the_content',
	function ( $content ) {
		if ( is_admin() || is_feed() || ! is_singular( 'post' ) || ! in_the_loop() || ! is_main_query() ) {
			return $content;
		}
		$lang = apply_filters( 'wpml_current_language', null );
		if ( ! $lang ) {
			$lang = substr( get_locale(), 0, 2 );
		}
		$sk    = ( 'sk' === $lang );
		$label = $sk ? 'Pridajte si Virtuse ako preferovaný zdroj na Google' : 'Add Virtuse as a preferred source on Google';
		$url   = 'https://www.google.com/preferences/source?q=' . rawurlencode( VIRTUSE_PREF_SOURCE_DOMAIN );
		$push  = "(window.dataLayer=window.dataLayer||[]).push({event:'preferred_source_click',link_type:'deeplink',page_lang:'" . ( $sk ? 'sk' : 'en' ) . "'})";
		$box   = '<p class="vb-pref" style="margin:32px 0 0;padding-top:16px;border-top:1px solid rgba(0,0,0,.12);font-weight:600">'
			. '<a href="' . esc_url( $url ) . '" target="_blank" rel="noopener" onclick="' . esc_attr( $push ) . '" style="color:#c46a0c;text-decoration:underline">'
			. esc_html( $label ) . '</a></p>';
		return $content . $box;
	},
	20
);
