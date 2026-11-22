<?php
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}
?>
<script>
(function () {
  var btn = document.getElementById('klyv-theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', function () {
    document.documentElement.classList.toggle('dark');
  });
})();
</script>
<?php wp_footer(); ?>
</body>
</html>
