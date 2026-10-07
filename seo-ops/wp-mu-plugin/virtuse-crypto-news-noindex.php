<?php
/**
 * Plugin Name: Virtuse Crypto News noindex
 * Description: Hides the old "Crypto News" / "Krypto novinky" posts (2021-2023) and their two category pages from search engines (noindex, follow) and leaves them out of Yoast's XML sitemap. The posts stay readable. The list is virtuse-crypto-news-noindex.json next to this file ({"posts": [post IDs], "terms": [category IDs]}), written by seo-ops/crypto_news_noindex.py in the site repo. Rollback: delete this file.
 * Version: 1.0
 *
 * Must-use plugin: lives in wp-content/mu-plugins/. It changes nothing in the
 * database; it only filters what Yoast SEO prints. Anything not in the JSON is
 * untouched. If the JSON is missing or unreadable, nothing changes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * array( 'posts' => id => true, 'terms' => id => true ), read once per request.
 *
 * @return array
 */
function virtuse_crypto_news_noindex_list() {
	static $list = null;
	if ( null !== $list ) {
		return $list;
	}
	$list = array(
		'posts' => array(),
		'terms' => array(),
	);
	$file = __DIR__ . '/virtuse-crypto-news-noindex.json';
	if ( ! is_readable( $file ) ) {
		return $list;
	}
	$data = json_decode( (string) file_get_contents( $file ), true );
	if ( ! is_array( $data ) ) {
		return $list;
	}
	foreach ( array( 'posts', 'terms' ) as $key ) {
		if ( isset( $data[ $key ] ) && is_array( $data[ $key ] ) ) {
			foreach ( $data[ $key ] as $id ) {
				if ( (int) $id > 0 ) {
					$list[ $key ][ (int) $id ] = true;
				}
			}
		}
	}
	return $list;
}

/**
 * Whether the page Yoast is presenting is on the list.
 *
 * @param mixed $presentation Yoast's Indexable_Presentation (second filter argument).
 * @return bool
 */
function virtuse_crypto_news_noindex_applies( $presentation ) {
	$list = virtuse_crypto_news_noindex_list();
	if ( is_object( $presentation ) && isset( $presentation->model ) && is_object( $presentation->model ) ) {
		$type = isset( $presentation->model->object_type ) ? $presentation->model->object_type : '';
		$id   = isset( $presentation->model->object_id ) ? (int) $presentation->model->object_id : 0;
		if ( 'post' === $type ) {
			return isset( $list['posts'][ $id ] );
		}
		if ( 'term' === $type ) {
			return isset( $list['terms'][ $id ] );
		}
		return false;
	}
	if ( is_singular( 'post' ) ) {
		return isset( $list['posts'][ (int) get_queried_object_id() ] );
	}
	if ( is_category() ) {
		return isset( $list['terms'][ (int) get_queried_object_id() ] );
	}
	return false;
}

function virtuse_crypto_news_noindex_robots( $robots, $presentation = null ) {
	if ( is_array( $robots ) && virtuse_crypto_news_noindex_applies( $presentation ) ) {
		$robots['index']  = 'noindex';
		$robots['follow'] = 'follow';
		// Snippet/preview directives only matter for indexed pages.
		unset( $robots['max-snippet'], $robots['max-image-preview'], $robots['max-video-preview'] );
	}
	return $robots;
}

function virtuse_crypto_news_noindex_sitemap_posts( $ids ) {
	$ids  = is_array( $ids ) ? $ids : array();
	$list = virtuse_crypto_news_noindex_list();
	return array_merge( $ids, array_keys( $list['posts'] ) );
}

function virtuse_crypto_news_noindex_sitemap_terms( $ids ) {
	$ids  = is_array( $ids ) ? $ids : array();
	$list = virtuse_crypto_news_noindex_list();
	return array_merge( $ids, array_keys( $list['terms'] ) );
}

add_filter( 'wpseo_robots_array', 'virtuse_crypto_news_noindex_robots', 20, 2 );
add_filter( 'wpseo_exclude_from_sitemap_by_post_ids', 'virtuse_crypto_news_noindex_sitemap_posts' );
add_filter( 'wpseo_exclude_from_sitemap_by_term_ids', 'virtuse_crypto_news_noindex_sitemap_terms' );
