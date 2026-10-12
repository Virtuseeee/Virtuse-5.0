<?php
/**
 * Plugin Name: Virtuse Brief link
 * Description: On WordPress stories that have a virtuse.com copy (listed in virtuse-story-canonical.json, see virtuse-story-canonical.php), shows a small bar at the top of the page: "Read the Brief on virtuse.com" linking to the story's virtuse.com page. Rollback: delete this file.
 * Version: 1.0
 *
 * Must-use plugin (wp-content/mu-plugins/). No database writes. Uses the
 * wp_body_open hook, so it shows only on themes that call wp_body_open();
 * on others it does nothing. Needs virtuse-story-canonical.php (for the map).
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
	'wp_body_open',
	function () {
		if ( ! is_singular( 'post' ) || ! function_exists( 'virtuse_story_canonical_map' ) ) {
			return;
		}
		$map = virtuse_story_canonical_map();
		$id  = get_queried_object_id();
		if ( ! isset( $map[ $id ] ) ) {
			return;
		}
		$sk    = ( false !== strpos( $map[ $id ], '://virtuse.com/sk/' ) );
		$label = $sk ? 'Čítajte Brief na virtuse.com' : 'Read the Brief on virtuse.com';
		printf(
			'<div style="background:#08090a;color:#e6edf3;font:600 14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:10px 16px"><a href="%s" style="color:#f7931a;text-decoration:none">%s &rarr;</a></div>',
			esc_url( $map[ $id ] ),
			esc_html( $label )
		);
	}
);
