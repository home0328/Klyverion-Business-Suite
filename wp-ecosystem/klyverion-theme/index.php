<?php
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

get_header();
?>
<div class="klyv-shell">
  <aside class="klyv-sidebar" aria-label="<?php esc_attr_e('Navegação principal', 'klyverion-theme'); ?>">
    <div class="klyv-brand">
      <span><?php bloginfo('name'); ?></span>
    </div>
    <?php
    if (has_nav_menu('klyv_primary')) {
        wp_nav_menu([
            'theme_location' => 'klyv_primary',
            'container'      => 'nav',
            'menu_class'     => 'klyv-nav-list',
            'fallback_cb'    => false,
        ]);
    }
    ?>
  </aside>

  <main id="klyv-main" class="klyv-main">
    <header class="klyv-topbar">
      <div class="klyv-breadcrumb">
        <?php echo esc_html(get_the_title() ?: get_bloginfo('name')); ?>
      </div>
      <div class="klyv-topbar-actions">
        <button type="button" id="klyv-theme-toggle" class="klyv-btn-outline">
          <?php esc_html_e('Alternar Tema', 'klyverion-theme'); ?>
        </button>
      </div>
    </header>

    <section class="klyv-content">
      <?php if (have_posts()) : ?>
        <?php while (have_posts()) : the_post(); ?>
          <article id="post-<?php the_ID(); ?>" <?php post_class('klyv-card'); ?>>
            <h1 class="klyv-heading"><?php the_title(); ?></h1>
            <div class="klyv-prose">
              <?php the_content(); ?>
            </div>
          </article>
        <?php endwhile; ?>
      <?php else : ?>
        <div class="klyv-card">
          <h1 class="klyv-heading"><?php esc_html_e('Klyverion Business Suite', 'klyverion-theme'); ?></h1>
          <p class="klyv-muted"><?php esc_html_e('One Platform. Every Business Operation.', 'klyverion-theme'); ?></p>
        </div>
      <?php endif; ?>
    </section>
  </main>
</div>
<?php
get_footer();
