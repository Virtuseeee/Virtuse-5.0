<?php
/**
 * Plugin Name: Virtuse story canonical
 * Description: Points the canonical URL (and og:url) of WordPress stories that also exist on virtuse.com/stories/ at the virtuse.com copy, and leaves those posts out of Yoast's XML sitemap. The list of posts is virtuse-story-canonical.json next to this file ({"posts": {post ID: URL}}), written by stories-build/build.mjs in the site repo and uploaded by its upload.sftp. Rollback: delete this file.
 * Version: 1.0
 *
 * Must-use plugin: lives in wp-content/mu-plugins/. It changes nothing in the
 * database; it only filters what Yoast SEO prints. Posts not in the JSON keep
 * Yoast's own canonical and stay in the sitemap. If the JSON is missing or
 * unreadable, nothing changes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Post ID => virtuse.com URL, read once per request. Only https://virtuse.com/ URLs are used.
 *
 * @return array
 */
function virtuse_story_canonical_map() {
	static $map = null;
	if ( null !== $map ) {
		return $map;
	}
	$map  = array();
	$file = __DIR__ . '/virtuse-story-canonical.json';
	if ( ! is_readable( $file ) ) {
		return $map;
	}
	$data = json_decode( (string) file_get_contents( $file ), true );
	if ( ! is_array( $data ) || ! isset( $data['posts'] ) || ! is_array( $data['posts'] ) ) {
		return $map;
	}
	foreach ( $data['posts'] as $id => $url ) {
		if ( is_string( $url ) && 0 === strpos( $url, 'https://virtuse.com/' ) && (int) $id > 0 ) {
			$map[ (int) $id ] = $url;
		}
	}
	return $map;
}

/**
 * The virtuse.com URL for the post being presented, or null.
 *
 * @param mixed $presentation Yoast's Indexable_Presentation (second filter argument).
 * @return string|null
 */
function virtuse_story_canonical_for( $presentation ) {
	$map = virtuse_story_canonical_map();
	if ( empty( $map ) ) {
		return null;
	}
	$id = 0;
	if ( is_object( $presentation ) && isset( $presentation->model ) && is_object( $presentation->model ) ) {
		if ( isset( $presentation->model->object_type ) && 'post' === $presentation->model->object_type ) {
			$id = (int) $presentation->model->object_id;
		}
	} elseif ( is_singular( 'post' ) ) {
		$id = (int) get_queried_object_id();
	}
	return ( $id > 0 && isset( $map[ $id ] ) ) ? $map[ $id ] : null;
}

function virtuse_story_canonical_filter( $url, $presentation = null ) {
	$target = virtuse_story_canonical_for( $presentation );
	return ( null !== $target ) ? $target : $url;
}

add_filter( 'wpseo_canonical', 'virtuse_story_canonical_filter', 20, 2 );
add_filter( 'wpseo_opengraph_url', 'virtuse_story_canonical_filter', 20, 2 );

/**
 * The virtuse.com copy is the main one, so the WordPress originals leave the blog's sitemap
 * (virtuse.com/sitemap.xml lists the story pages).
 *
 * @param mixed $ids Post IDs Yoast already excludes.
 * @return array
 */
function virtuse_story_canonical_sitemap_exclude( $ids ) {
	$ids = is_array( $ids ) ? $ids : array();
	return array_merge( $ids, array_keys( virtuse_story_canonical_map() ) );
}

add_filter( 'wpseo_exclude_from_sitemap_by_post_ids', 'virtuse_story_canonical_sitemap_exclude' );
