<?php
/**
 * Plugin Name: Virtuse story autopublish
 * Description: When a Blog / Topic-of-the-day post is published, writes its virtuse.com story page at once (stories/<slug>/, sk/stories/<slug>/, ru/stories/<id>/), so links never wait for the daily stories build and a manual upload. Public views of such a post on blog.virtuse.com are 301-redirected to that page. Rollback: delete this file (pages it wrote stay; the next build and deploy treat them like any other).
 * Version: 1.0
 *
 * Must-use plugin (wp-content/mu-plugins/). Writes no post data; it only
 * stores the result of its last run in the option vb_autostory_last.
 *
 * Page: a copy of the newest story page the build wrote for the same language
 * (same folder depth, same chrome, same scripts), with the story's own head,
 * headline, dek, byline, hero image and body filled in. article.js loads the
 * post from WordPress anyway and replaces the body when WordPress is newer.
 * Pages this plugin writes carry the marker comment <!-- vb-autostory -->.
 * Only those are ever rewritten or deleted here; a page written by the build
 * is never touched. The next build overwrites the plugin's page with its own.
 *
 * Redirect: only for published posts in the story categories whose page
 * exists (the canonical map from virtuse-story-canonical.php first, then the
 * file on disk). Previews, feeds, embeds and ?vb_wp=1 are left alone.
 *
 * Site root: VIRTUSE_SITE_ROOT if defined in wp-config.php, else the
 * public_html folder next to this WordPress install (Webglobe: _sub/blog).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'VB_AUTOSTORY_MARK', '<!-- vb-autostory -->' );

/** Story categories per language (same as stories-build/build.mjs FEEDS). */
function vb_autostory_feeds() {
	return array(
		'en' => array( 'cats' => array( 13, 137 ), 'dir' => 'stories/', 'home' => 'https://virtuse.com/' ),
		'sk' => array( 'cats' => array( 26, 138 ), 'dir' => 'sk/stories/', 'home' => 'https://virtuse.com/sk/' ),
		'ru' => array( 'cats' => array( 57 ), 'dir' => 'ru/stories/', 'home' => 'https://virtuse.com/ru/' ),
	);
}

/** The static site's document root, or '' if it cannot be found. */
function vb_autostory_root() {
	static $root = null;
	if ( null !== $root ) {
		return $root;
	}
	$candidates = array();
	if ( defined( 'VIRTUSE_SITE_ROOT' ) ) {
		$candidates[] = VIRTUSE_SITE_ROOT;
	}
	$candidates[] = dirname( ABSPATH, 2 ) . '/public_html';
	$candidates[] = dirname( ABSPATH ) . '/public_html';
	$root = '';
	foreach ( $candidates as $c ) {
		$c = rtrim( $c, '/' );
		if ( @is_file( $c . '/article.html' ) && @is_dir( $c . '/stories' ) ) {
			$root = $c;
			break;
		}
	}
	return $root;
}

/** array( lang, folder relative to the site root ) or null when the post is not a story. */
function vb_autostory_target( $post ) {
	$post = get_post( $post );
	if ( ! $post || 'post' !== $post->post_type ) {
		return null;
	}
	$cats = array_map( 'intval', wp_get_post_categories( $post->ID ) );
	foreach ( vb_autostory_feeds() as $lang => $feed ) {
		if ( array_intersect( $cats, $feed['cats'] ) ) {
			$slug = urldecode( $post->post_name );
			// Same rule as article.js storyPath(): ASCII slugs, else the post ID; RU always the ID.
			$key = ( 'ru' !== $lang && preg_match( '/^[a-z0-9-]+$/', $slug ) ) ? $slug : (string) $post->ID;
			return array( $lang, $feed['dir'] . $key . '/' );
		}
	}
	return null;
}

function vb_autostory_url( $folder ) {
	return 'https://virtuse.com/' . $folder;
}

/* ---------------------------------------------------------------- render */

function vb_autostory_esc( $s ) {
	return htmlspecialchars( (string) $s, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
}

function vb_autostory_text( $html ) {
	$t = wp_strip_all_tags( (string) $html );
	$t = html_entity_decode( $t, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	return trim( preg_replace( '/\s+/u', ' ', $t ) );
}

function vb_autostory_clip( $s, $max ) {
	if ( mb_strlen( $s ) <= $max ) {
		return $s;
	}
	$cut = mb_substr( $s, 0, $max - 1 );
	$sp  = mb_strrpos( $cut, ' ' );
	if ( false !== $sp && $sp > $max * 0.6 ) {
		$cut = mb_substr( $cut, 0, $sp );
	}
	return rtrim( $cut, ' ,.;:' ) . '…';
}

function vb_autostory_byline_date( $gmt, $lang ) {
	$ts = strtotime( $gmt . ' UTC' );
	if ( ! $ts ) {
		return '';
	}
	$time = gmdate( 'H:i', $ts ) . ' UTC';
	$d    = (int) gmdate( 'j', $ts );
	$m    = (int) gmdate( 'n', $ts );
	$y    = gmdate( 'Y', $ts );
	if ( 'sk' === $lang ) {
		return $d . '. ' . $m . '. ' . $y . ' · ' . $time;
	}
	if ( 'ru' === $lang ) {
		$ru = array( 'янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.' );
		return $d . ' ' . $ru[ $m - 1 ] . ' ' . $y . ' г. · ' . $time;
	}
	return $d . ' ' . gmdate( 'F', $ts ) . ' ' . $y . ' · ' . $time;
}

function vb_autostory_is_ours( $file ) {
	$head = (string) @file_get_contents( $file, false, null, 0, 4096 );
	return false !== strpos( $head, VB_AUTOSTORY_MARK );
}

/** Newest page the build wrote for this language (not one of ours), or ''. */
function vb_autostory_template( $root, $dir, $own_folder ) {
	$best   = '';
	$best_t = 0;
	$files  = glob( $root . '/' . $dir . '*/index.html' );
	foreach ( (array) $files as $f ) {
		if ( $root . '/' . $own_folder . 'index.html' === $f ) {
			continue;
		}
		$t = (int) @filemtime( $f );
		if ( $t > $best_t && ! vb_autostory_is_ours( $f ) ) {
			$best   = $f;
			$best_t = $t;
		}
	}
	return $best;
}

/** Replace exactly one match of $pattern; null if it does not match exactly once. */
function vb_autostory_sub( $html, $pattern, $replacement ) {
	$n   = 0;
	$out = preg_replace_callback(
		$pattern,
		function ( $m ) use ( $replacement ) {
			return is_callable( $replacement ) ? $replacement( $m ) : $replacement;
		},
		$html,
		-1,
		$n
	);
	return ( 1 === $n && null !== $out ) ? $out : null;
}

function vb_autostory_render( $post, $lang, $folder, $root ) {
	$feeds    = vb_autostory_feeds();
	$feed     = $feeds[ $lang ];
	$template = vb_autostory_template( $root, $feed['dir'], $folder );
	if ( '' === $template ) {
		return new WP_Error( 'vb_template', 'No story page to copy in ' . $feed['dir'] );
	}
	$html = (string) file_get_contents( $template );
	if ( ! preg_match( '/<html[^>]*data-story="([^"]+)"/', $html, $m ) ) {
		return new WP_Error( 'vb_template', 'Template has no data-story: ' . $template );
	}
	$old_folder = $m[1];
	$old_key    = basename( rtrim( $old_folder, '/' ) );
	$new_key    = basename( rtrim( $folder, '/' ) );
	$url        = vb_autostory_url( $folder );
	$e          = 'vb_autostory_esc';

	$title   = vb_autostory_text( get_the_title( $post ) );
	$excerpt = has_excerpt( $post ) ? vb_autostory_text( $post->post_excerpt ) : '';
	$content = apply_filters( 'the_content', $post->post_content );
	$desc    = vb_autostory_clip( '' !== $excerpt ? $excerpt : vb_autostory_text( $content ), 160 );
	$words   = count( preg_split( '/\s+/u', vb_autostory_text( $content ), -1, PREG_SPLIT_NO_EMPTY ) );
	$read    = max( 1, (int) ceil( $words / 200 ) ) . ( 'ru' === $lang ? ' мин' : ' min' );
	$pub     = gmdate( 'Y-m-d\TH:i:s.000\Z', strtotime( $post->post_date_gmt . ' UTC' ) );
	$mod     = gmdate( 'Y-m-d\TH:i:s.000\Z', strtotime( $post->post_modified_gmt . ' UTC' ) );
	$mod_wp  = str_replace( ' ', 'T', $post->post_modified_gmt ); // REST modified_gmt, compared by article.js

	// Featured image (falls back to the site's generic card).
	$img      = array( 'url' => 'https://virtuse.com/news/og-card.png?v=20260921', 'w' => 1200, 'h' => 630, 'srcset' => '', 'alt' => $title );
	$thumb_id = get_post_thumbnail_id( $post );
	if ( $thumb_id ) {
		$src = wp_get_attachment_image_src( $thumb_id, 'full' );
		if ( $src ) {
			$alt = trim( (string) get_post_meta( $thumb_id, '_wp_attachment_image_alt', true ) );
			$img = array(
				'url'    => $src[0],
				'w'      => (int) $src[1],
				'h'      => (int) $src[2],
				'srcset' => (string) wp_get_attachment_image_srcset( $thumb_id, 'full' ),
				'alt'    => '' !== $alt ? $alt : $title,
			);
		}
	}

	$steps = array(
		array( '/data-slug="[^"]*"/', 'data-slug="' . $e( $post->post_name ) . '"' ),
		array( '/data-story="[^"]*"/', 'data-story="' . $e( $folder ) . '"' ),
		array( '/<title>.*?<\/title>/s', '<title>' . $e( $title ) . ' | Virtuse Brief</title>' ),
		array( '/<meta name="description" content="[^"]*">/', '<meta name="description" content="' . $e( $desc ) . '">' ),
		array( '/<link rel="canonical" href="[^"]*">/', '<link rel="canonical" href="' . $e( $url ) . '">' ),
		array( '/<meta property="og:title" content="[^"]*">/', '<meta property="og:title" content="' . $e( $title ) . '">' ),
		array( '/<meta property="og:description" content="[^"]*">/', '<meta property="og:description" content="' . $e( $desc ) . '">' ),
		array( '/<meta property="og:url" content="[^"]*">/', '<meta property="og:url" content="' . $e( $url ) . '">' ),
		array( '/<meta property="og:image" content="[^"]*">/', '<meta property="og:image" content="' . $e( $img['url'] ) . '">' ),
		array( '/<meta property="og:image:width" content="[^"]*">/', '<meta property="og:image:width" content="' . $img['w'] . '">' ),
		array( '/<meta property="og:image:height" content="[^"]*">/', '<meta property="og:image:height" content="' . $img['h'] . '">' ),
		array( '/<meta property="og:image:alt" content="[^"]*">/', '<meta property="og:image:alt" content="' . $e( $img['alt'] ) . '">' ),
		array( '/<meta property="article:published_time" content="[^"]*">/', '<meta property="article:published_time" content="' . $pub . '">' ),
		array( '/<meta property="article:modified_time" content="[^"]*">/', '<meta property="article:modified_time" content="' . $mod . '">' ),
		array( '/<meta name="twitter:title" content="[^"]*">/', '<meta name="twitter:title" content="' . $e( $title ) . '">' ),
		array( '/<meta name="twitter:description" content="[^"]*">/', '<meta name="twitter:description" content="' . $e( $desc ) . '">' ),
		array( '/<meta name="twitter:image" content="[^"]*">/', '<meta name="twitter:image" content="' . $e( $img['url'] ) . '">' ),
		array(
			'/(<h1 class="story-title" id="articleTitle">).*?(<\/h1>)/s',
			function ( $m ) use ( $title, $e ) {
				return $m[1] . $e( $title ) . $m[2];
			},
		),
		array(
			'/<p class="story-dek" id="articleDek"[^>]*>.*?<\/p>/s',
			'' !== $excerpt
				? '<p class="story-dek" id="articleDek">' . $e( $excerpt ) . '</p>'
				: '<p class="story-dek" id="articleDek" hidden></p>',
		),
		array(
			'/(<span id="bylineDate">).*?(<\/span>)/s',
			function ( $m ) use ( $post, $lang ) {
				return $m[1] . vb_autostory_byline_date( $post->post_date_gmt, $lang ) . $m[2];
			},
		),
		array(
			'/(<span id="bylineRead">).*?(<\/span>)/s',
			function ( $m ) use ( $read ) {
				return $m[1] . $read . $m[2];
			},
		),
		array(
			'/<img id="heroImg"[^>]*>/',
			'<img id="heroImg" src="' . $e( $img['url'] ) . '"'
				. ( '' !== $img['srcset'] ? ' srcset="' . $e( $img['srcset'] ) . '" sizes="(max-width: 712px) calc(100vw - 32px), 680px"' : '' )
				. ' alt="' . $e( $img['alt'] ) . '" width="' . $img['w'] . '" height="' . $img['h'] . '" fetchpriority="high">',
		),
		array(
			'/(<div class="story-body" id="articleBody")[^>]*>.*?(<\/div>\s*<!-- STORIES-RELATED:START -->)/s',
			function ( $m ) use ( $content, $mod_wp, $e ) {
				return $m[1] . ' data-modified="' . $e( $mod_wp ) . "\">\n" . wp_kses_post( $content ) . "\n" . $m[2];
			},
		),
	);
	foreach ( $steps as $i => $s ) {
		$next = vb_autostory_sub( $html, $s[0], $s[1] );
		if ( null === $next ) {
			return new WP_Error( 'vb_template', 'Template step ' . $i . ' did not match once (' . $s[0] . ') in ' . $template );
		}
		$html = $next;
	}

	// hreflang: this page only (translations are paired by the build).
	$html = preg_replace( '/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\s*/', '', $html );
	$alt  = '<link rel="alternate" hreflang="' . $lang . '" href="' . $e( $url ) . "\">\n"
		. '<link rel="alternate" hreflang="x-default" href="' . $e( $url ) . "\">\n";
	$html = preg_replace( '/(<link rel="canonical" href="[^"]*">\n)/', '$1' . str_replace( '$', '\$', $alt ), $html, 1 );

	// JSON-LD: rebuild the Article and BreadcrumbList blocks.
	$article = array(
		'@context'         => 'https://schema.org',
		'@type'            => 'Article',
		'headline'         => $title,
		'description'      => $desc,
		'inLanguage'       => $lang,
		'datePublished'    => $pub,
		'dateModified'     => $mod,
		'mainEntityOfPage' => $url,
		'url'              => $url,
		'image'            => $img['url'],
		'author'           => array( '@type' => 'Person', 'name' => 'Ras Vasilisin', 'url' => 'https://virtuse.com/about.html', 'sameAs' => array( 'https://www.linkedin.com/in/rastislav-vasilisin-11bb5819/' ) ),
		'publisher'        => array( '@type' => 'Organization', 'name' => 'Virtuse', 'url' => 'https://virtuse.com/', 'logo' => array( '@type' => 'ImageObject', 'url' => 'https://virtuse.com/news/brief-nav-logo.png' ) ),
	);
	$crumbs  = array(
		'@context'        => 'https://schema.org',
		'@type'           => 'BreadcrumbList',
		'itemListElement' => array(
			array( '@type' => 'ListItem', 'position' => 1, 'name' => 'Virtuse', 'item' => $feed['home'] ),
			array( '@type' => 'ListItem', 'position' => 2, 'name' => 'Virtuse Brief', 'item' => 'https://virtuse.com/news.html' ),
			array( '@type' => 'ListItem', 'position' => 3, 'name' => 'Blog', 'item' => 'https://virtuse.com/' . $feed['dir'] ),
			array( '@type' => 'ListItem', 'position' => 4, 'name' => $title, 'item' => $url ),
		),
	);
	$flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG;
	$ld    = function ( $type, $data ) use ( &$html, $flags ) {
		$html = preg_replace_callback(
			'/<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org","@type":"' . $type . '".*?<\/script>/s',
			function () use ( $data, $flags ) {
				return '<script type="application/ld+json">' . wp_json_encode( $data, $flags ) . '</script>';
			},
			$html,
			1
		);
	};
	$ld( 'Article', $article );
	$ld( 'BreadcrumbList', $crumbs );

	// Brief CTA campaign source names the story, like the build does.
	$prefix = ( 'en' === $lang ) ? '' : $lang . '-';
	$html   = str_replace( 'utm_source=' . $prefix . $old_key . '&', 'utm_source=' . $prefix . $new_key . '&', $html );

	// Nothing from the template story may survive.
	if ( false !== strpos( $html, $old_folder ) ) {
		return new WP_Error( 'vb_template', 'Template story path still present (' . $old_folder . ')' );
	}
	return preg_replace( '/^<!DOCTYPE html>/i', "<!DOCTYPE html>\n" . VB_AUTOSTORY_MARK, $html, 1 );
}

/* ---------------------------------------------------------------- write */

/**
 * Write (or refresh) the story page for a published post.
 *
 * @return string|WP_Error 'created' | 'updated' | 'exists' (build page, untouched) | 'skipped'
 */
function vb_autostory_write( $post_id ) {
	$post = get_post( $post_id );
	if ( ! $post || 'publish' !== $post->post_status ) {
		return 'skipped';
	}
	$target = vb_autostory_target( $post );
	if ( ! $target ) {
		return 'skipped';
	}
	list( $lang, $folder ) = $target;
	$root = vb_autostory_root();
	if ( '' === $root ) {
		return new WP_Error( 'vb_root', 'virtuse.com document root not found (set VIRTUSE_SITE_ROOT in wp-config.php)' );
	}
	$file = $root . '/' . $folder . 'index.html';
	$had  = is_file( $file );
	if ( $had && ! vb_autostory_is_ours( $file ) ) {
		return 'exists';
	}
	$html = vb_autostory_render( $post, $lang, $folder, $root );
	if ( is_wp_error( $html ) ) {
		return $html;
	}
	if ( ! is_dir( dirname( $file ) ) && ! wp_mkdir_p( dirname( $file ) ) ) {
		return new WP_Error( 'vb_write', 'Cannot create ' . dirname( $file ) );
	}
	$tmp = $file . '.tmp' . wp_rand();
	if ( false === @file_put_contents( $tmp, $html ) || ! @rename( $tmp, $file ) ) {
		@unlink( $tmp );
		return new WP_Error( 'vb_write', 'Cannot write ' . $file );
	}
	@chmod( $file, 0644 );
	return $had ? 'updated' : 'created';
}

/** Remove a page this plugin wrote (never a build page). */
function vb_autostory_remove( $post_id ) {
	$target = vb_autostory_target( $post_id );
	$root   = vb_autostory_root();
	if ( ! $target || '' === $root ) {
		return;
	}
	$file = $root . '/' . $target[1] . 'index.html';
	if ( is_file( $file ) && vb_autostory_is_ours( $file ) ) {
		@unlink( $file );
		@rmdir( dirname( $file ) );
	}
}

function vb_autostory_log( $post_id, $result ) {
	$msg = is_wp_error( $result ) ? 'ERROR ' . $result->get_error_message() : $result;
	update_option( 'vb_autostory_last', array( 'post' => (int) $post_id, 'result' => $msg, 'time' => gmdate( 'c' ) ), false );
	if ( is_wp_error( $result ) ) {
		error_log( 'virtuse-story-autopublish post ' . $post_id . ': ' . $msg );
	}
}

// Runs after the post and its categories are saved (classic editor, REST, block editor).
add_action(
	'wp_after_insert_post',
	function ( $post_id, $post ) {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) || 'post' !== $post->post_type ) {
			return;
		}
		if ( 'publish' === $post->post_status ) {
			$r = vb_autostory_write( $post_id );
			if ( 'skipped' !== $r ) {
				vb_autostory_log( $post_id, $r );
			}
		} else {
			vb_autostory_remove( $post_id );
		}
	},
	20,
	2
);
add_action( 'before_delete_post', 'vb_autostory_remove' );
add_action( 'wp_trash_post', 'vb_autostory_remove' );

/* ---------------------------------------------------------------- redirect */

function vb_autostory_public_url( $post_id ) {
	if ( function_exists( 'virtuse_story_canonical_map' ) ) {
		$map = virtuse_story_canonical_map();
		if ( isset( $map[ $post_id ] ) ) {
			return $map[ $post_id ];
		}
	}
	$target = vb_autostory_target( $post_id );
	$root   = vb_autostory_root();
	if ( $target && '' !== $root && is_file( $root . '/' . $target[1] . 'index.html' ) ) {
		return vb_autostory_url( $target[1] );
	}
	return null;
}

add_action(
	'template_redirect',
	function () {
		if ( ! is_singular( 'post' ) || is_preview() || is_embed() || is_feed() || isset( $_GET['vb_wp'] ) ) {
			return;
		}
		$post = get_queried_object();
		if ( ! $post || 'publish' !== $post->post_status ) {
			return;
		}
		$url = vb_autostory_public_url( (int) $post->ID );
		if ( $url ) {
			wp_redirect( $url, 301, 'Virtuse' );
			exit;
		}
	},
	1
);

/* ---------------------------------------------------------------- admin */

// Edit screen notice: where the story lives, and a button to (re)create the page.
add_action(
	'admin_notices',
	function () {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || 'post' !== $screen->base || 'post' !== $screen->post_type || empty( $_GET['post'] ) ) {
			return;
		}
		$id     = (int) $_GET['post'];
		$target = vb_autostory_target( $id );
		if ( ! $target ) {
			return;
		}
		$root = vb_autostory_root();
		$url  = vb_autostory_url( $target[1] );
		$file = '' !== $root ? $root . '/' . $target[1] . 'index.html' : '';
		if ( '' === $root ) {
			$state = 'virtuse.com document root not found; pages cannot be written.';
		} elseif ( ! is_file( $file ) ) {
			$state = 'virtuse.com page does not exist yet.';
		} elseif ( vb_autostory_is_ours( $file ) ) {
			$state = 'virtuse.com page written by this plugin (the next stories build replaces it).';
		} else {
			$state = 'virtuse.com page from the stories build.';
		}
		$last = get_option( 'vb_autostory_last' );
		$note = ( is_array( $last ) && (int) $last['post'] === $id ) ? ' Last run: ' . $last['result'] . '.' : '';
		echo '<div class="notice notice-info"><p><strong>Virtuse story:</strong> <a href="' . esc_url( $url ) . '" target="_blank" rel="noopener">' . esc_html( $url ) . '</a> — ' . esc_html( $state . $note );
		if ( 'publish' === get_post_status( $id ) ) {
			$btn = wp_nonce_url( admin_url( 'admin-post.php?action=vb_autostory&post=' . $id ), 'vb_autostory_' . $id );
			echo ' <a class="button button-small" href="' . esc_url( $btn ) . '">Create / refresh page</a>';
		}
		echo '</p></div>';
	}
);

add_action(
	'admin_post_vb_autostory',
	function () {
		$id = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0;
		if ( ! $id || ! current_user_can( 'edit_post', $id ) ) {
			wp_die( 'Not allowed.' );
		}
		check_admin_referer( 'vb_autostory_' . $id );
		vb_autostory_log( $id, vb_autostory_write( $id ) );
		wp_safe_redirect( admin_url( 'post.php?post=' . $id . '&action=edit' ) );
		exit;
	}
);
