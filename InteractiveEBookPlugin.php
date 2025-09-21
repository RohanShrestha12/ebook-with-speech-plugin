<?php
/**
 * Plugin Name: Interactive eBook Plugin
 * Description: Create interactive eBooks with chapters displayed in sliders and text-to-audio conversion
 * Version: 2.0.0
 * Author: Your Name
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('EBOOK_PLUGIN_URL', plugin_dir_url(__FILE__));
define('EBOOK_PLUGIN_PATH', plugin_dir_path(__FILE__));

class InteractiveEBookPlugin
{

    public function __construct()
    {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post', array($this, 'save_meta_boxes'));
        add_shortcode('ebook_slider', array($this, 'ebook_slider_shortcode'));
        add_action('wp_ajax_convert_text_to_audio', array($this, 'convert_text_to_audio'));
        add_action('wp_ajax_nopriv_convert_text_to_audio', array($this, 'convert_text_to_audio'));
        add_shortcode('ebook_chapters_debug', array($this, 'debug_chapters'));

        // Add custom columns to admin
        add_filter('manage_ebook_chapter_posts_columns', array($this, 'add_admin_columns'));
        add_action('manage_ebook_chapter_posts_custom_column', array($this, 'display_admin_columns'), 10, 2);
        add_filter('manage_edit-ebook_chapter_sortable_columns', array($this, 'make_columns_sortable'));

        register_activation_hook(__FILE__, array($this, 'activate'));
    }

    public function init()
    {
        $this->create_post_types();
        $this->create_taxonomies();
    }
public function debug_audio_generation($chapter_id) {
    $chapter = get_post($chapter_id);
    if (!$chapter) {
        return ['error' => 'Chapter not found'];
    }
    
    $api_key = get_option('ebook_openai_api_key');
    $text = strip_tags($chapter->post_content);
    $text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
    $text = trim($text);
    
    $debug_info = [
        'api_key_set' => !empty($api_key),
        'api_key_length' => strlen($api_key),
        'text_length' => strlen($text),
        'text_word_count' => str_word_count($text),
        'chapter_title' => $chapter->post_title,
        'wp_upload_dir' => wp_upload_dir(),
        'curl_version' => curl_version(),
    ];
    
    // Test API connection
    if (!empty($api_key)) {
        $test_response = $this->test_openai_connection($api_key);
        $debug_info['api_test'] = $test_response;
    }
    
    return $debug_info;
}

private function test_openai_connection($api_key) {
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => "https://api.openai.com/v1/models",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer " . $api_key,
        ],
        CURLOPT_TIMEOUT => 10,
    ]);
    
    $response = curl_exec($curl);
    $http_code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    
    return [
        'http_code' => $http_code,
        'success' => $http_code === 200,
        'response_preview' => substr($response, 0, 200)
    ];
}
    public function create_post_types()
    {
        // Register Chapters post type only
        register_post_type('ebook_chapter', array(
            'labels' => array(
                'name' => 'eBook Chapters',
                'singular_name' => 'Chapter',
                'add_new' => 'Add New Chapter',
                'add_new_item' => 'Add New Chapter',
                'edit_item' => 'Edit Chapter',
                'new_item' => 'New Chapter',
                'view_item' => 'View Chapter',
                'search_items' => 'Search Chapters',
                'not_found' => 'No chapters found',
                'not_found_in_trash' => 'No chapters found in trash'
            ),
            'public' => true,
            'has_archive' => true,
            'menu_icon' => 'dashicons-book',
            'supports' => array('title', 'editor', 'thumbnail', 'excerpt', 'page-attributes'),
            'rewrite' => array('slug' => 'chapters'),
            'show_in_rest' => true, // For Gutenberg support
            'taxonomies' => array('ebook') // Associate with ebook taxonomy
        ));
    }

    public function create_taxonomies()
    {
        // Create ebook taxonomy
        register_taxonomy('ebook', 'ebook_chapter', array(
            'hierarchical' => true,
            'labels' => array(
                'name' => 'eBooks',
                'singular_name' => 'eBook',
                'search_items' => 'Search eBooks',
                'all_items' => 'All eBooks',
                'parent_item' => 'Parent eBook',
                'parent_item_colon' => 'Parent eBook:',
                'edit_item' => 'Edit eBook',
                'update_item' => 'Update eBook',
                'add_new_item' => 'Add New eBook',
                'new_item_name' => 'New eBook Name',
                'menu_name' => 'eBooks',
            ),
            'show_ui' => true,
            'show_admin_column' => true,
            'show_in_rest' => true,
            'query_var' => true,
            'rewrite' => array('slug' => 'ebook'),
            'meta_box_cb' => array($this, 'ebook_meta_box') // Custom meta box for better UX
        ));
    }

    // Custom meta box for ebook taxonomy selection
    public function ebook_meta_box($post, $box)
    {
        $terms = wp_get_object_terms($post->ID, 'ebook');
        $selected_term = !empty($terms) ? $terms[0]->term_id : '';

        $all_ebooks = get_terms(array(
            'taxonomy' => 'ebook',
            'hide_empty' => false
        ));

        echo '<div id="taxonomy-ebook" class="categorydiv">';
        echo '<div id="ebook-all" class="tabs-panel">';
        echo '<ul id="ebookchecklist" class="categorychecklist form-no-clear">';
        echo '<li><label><input type="radio" name="tax_input[ebook][]" value="" ' . checked('', $selected_term, false) . '> None</label></li>';

        foreach ($all_ebooks as $ebook) {
            echo '<li><label>';
            echo '<input type="radio" name="tax_input[ebook][]" value="' . $ebook->term_id . '" ' . checked($ebook->term_id, $selected_term, false) . '> ';
            echo esc_html($ebook->name);
            echo '</label></li>';
        }

        echo '</ul></div></div>';

        // Add new ebook option
        echo '<div class="add-new-ebook" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">';
        echo '<h4>Add New eBook:</h4>';
        echo '<input type="text" id="new_ebook_name" placeholder="Enter new eBook name" style="width: 70%;" />';
        echo '<button type="button" id="add_new_ebook" class="button" style="margin-left: 5px;">Add eBook</button>';
        echo '</div>';
    }

    public function enqueue_scripts()
    {
        wp_enqueue_script('jquery');
        wp_enqueue_script('swiper-js', 'https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.js', array(), '8.0.0', true);
        wp_enqueue_style('swiper-css', 'https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.css', array(), '8.0.0');

        wp_enqueue_script('ebook-plugin-js', EBOOK_PLUGIN_URL . 'assets/ebook-plugin.js', array('jquery', 'swiper-js'), '2.0.0', true);
        wp_enqueue_style('ebook-plugin-css', EBOOK_PLUGIN_URL . 'assets/ebook-plugin.css', array('swiper-css'), '2.0.0');

        wp_localize_script('ebook-plugin-js', 'ebook_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('ebook_nonce')
        ));
    }

    public function admin_enqueue_scripts()
    {
        wp_enqueue_script('ebook-admin-js', EBOOK_PLUGIN_URL . 'assets/ebook-admin.js', array('jquery'), '2.0.0', true);
        wp_enqueue_style('ebook-admin-css', EBOOK_PLUGIN_URL . 'assets/ebook-admin.css', array(), '2.0.0');

        wp_localize_script('ebook-admin-js', 'ebook_admin_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('ebook_admin_nonce')
        ));
    }

    public function add_meta_boxes()
    {
        add_meta_box(
            'ebook_chapter_details',
            'Chapter Details',
            array($this, 'chapter_meta_box_callback'),
            'ebook_chapter',
            'side',
            'high'
        );

        add_meta_box(
            'ebook_audio_controls',
            'Audio Controls',
            array($this, 'audio_meta_box_callback'),
            'ebook_chapter',
            'side',
            'default'
        );
    }

    public function chapter_meta_box_callback($post)
    {
        wp_nonce_field('ebook_chapter_meta_nonce', 'ebook_chapter_meta_nonce');

        $chapter_order = get_post_meta($post->ID, '_ebook_chapter_order', true);
        if (empty($chapter_order)) {
            $chapter_order = $post->menu_order;
        }

        echo '<table class="form-table">';
        echo '<tr><th><label for="ebook_chapter_order">Chapter Order:</label></th><td>';
        echo '<input type="number" name="ebook_chapter_order" id="ebook_chapter_order" value="' . $chapter_order . '" min="1" style="width: 100%;" />';
        echo '<p class="description">Order of this chapter within the eBook</p>';
        echo '</td></tr>';
        echo '</table>';
    }

    public function audio_meta_box_callback($post)
    {
        $audio_url = get_post_meta($post->ID, '_ebook_audio_url', true);

        echo '<div class="audio-meta-box">';

        if ($audio_url) {
            echo '<div class="current-audio">';
            echo '<label><strong>Current Audio:</strong></label><br>';
            echo '<audio controls style="width: 100%; margin: 10px 0;">';
            echo '<source src="' . esc_url($audio_url) . '" type="audio/mpeg">';
            echo 'Your browser does not support the audio element.';
            echo '</audio>';
            echo '<p><a href="' . esc_url($audio_url) . '" target="_blank">View Audio File</a></p>';
            echo '</div>';
        }

        echo '<div class="audio-controls">';
        echo '<button type="button" id="generate_audio" class="button button-primary" data-chapter-id="' . $post->ID . '">';
        echo $audio_url ? 'Regenerate Audio' : 'Generate Audio';
        echo '</button>';
        echo '<div id="audio-generation-status" style="margin-top: 10px;"></div>';
        echo '</div>';

        echo '<div class="manual-audio-url" style="margin-top: 15px;">';
        echo '<label for="ebook_audio_url"><strong>Or enter audio URL manually:</strong></label><br>';
        echo '<input type="url" name="ebook_audio_url" id="ebook_audio_url" value="' . esc_attr($audio_url) . '" style="width: 100%;" placeholder="https://example.com/audio.mp3" />';
        echo '</div>';

        echo '</div>';
    }

    public function save_meta_boxes($post_id)
    {
        // Check for chapter meta nonce
        if (!isset($_POST['ebook_chapter_meta_nonce']) || !wp_verify_nonce($_POST['ebook_chapter_meta_nonce'], 'ebook_chapter_meta_nonce')) {
            return;
        }

        // Check if user has permission to edit the post
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        // Save chapter order
        if (isset($_POST['ebook_chapter_order'])) {
            $order = intval($_POST['ebook_chapter_order']);
            update_post_meta($post_id, '_ebook_chapter_order', $order);
            // Also update menu_order for native WordPress ordering
            wp_update_post(array(
                'ID' => $post_id,
                'menu_order' => $order
            ));
        }

        // Save audio URL
        if (isset($_POST['ebook_audio_url'])) {
            update_post_meta($post_id, '_ebook_audio_url', esc_url($_POST['ebook_audio_url']));
        }
    }

    // Add custom columns to admin list
    public function add_admin_columns($columns)
    {
        $new_columns = array();
        $new_columns['cb'] = $columns['cb'];
        $new_columns['title'] = $columns['title'];
        $new_columns['ebook'] = 'eBook';
        $new_columns['chapter_order'] = 'Order';
        $new_columns['audio_status'] = 'Audio';
        $new_columns['date'] = $columns['date'];

        return $new_columns;
    }

    public function display_admin_columns($column, $post_id)
    {
        switch ($column) {
            case 'chapter_order':
                $order = get_post_meta($post_id, '_ebook_chapter_order', true);
                echo $order ? $order : get_post($post_id)->menu_order;
                break;

            case 'audio_status':
                $audio_url = get_post_meta($post_id, '_ebook_audio_url', true);
                if ($audio_url) {
                    echo '<span style="color: green;">✓ Available</span>';
                } else {
                    echo '<span style="color: #ccc;">No Audio</span>';
                }
                break;
        }
    }

    public function make_columns_sortable($columns)
    {
        $columns['chapter_order'] = 'menu_order';
        return $columns;
    }

    public function ebook_slider_shortcode($atts)
    {
        $atts = shortcode_atts(array(
            'ebook' => '', // ebook slug or ID
            'height' => '500px'
        ), $atts);

        if (empty($atts['ebook'])) {
            return '<p>Please specify an ebook slug or ID for the slider.</p>';
        }

        // Get ebook term
        $ebook_term = null;
        if (is_numeric($atts['ebook'])) {
            $ebook_term = get_term($atts['ebook'], 'ebook');
        } else {
            $ebook_term = get_term_by('slug', $atts['ebook'], 'ebook');
        }

        if (!$ebook_term) {
            return '<p>eBook not found. Please check the ebook slug or ID.</p>';
        }

        // Get chapters for this ebook
        $chapters = get_posts(array(
            'post_type' => 'ebook_chapter',
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'tax_query' => array(
                array(
                    'taxonomy' => 'ebook',
                    'field' => 'term_id',
                    'terms' => $ebook_term->term_id,
                ),
            ),
            'meta_key' => '_ebook_chapter_order',
            'orderby' => 'meta_value_num menu_order',
            'order' => 'ASC'
        ));

        if (empty($chapters)) {
            return '<div class="ebook-no-chapters">
                <h3>No chapters found for this eBook.</h3>
                <p>Please check:</p>
                <ul>
                    <li>Chapters are published</li>
                    <li>Chapters are assigned to the "' . esc_html($ebook_term->name) . '" eBook</li>
                    <li>eBook slug/ID is correct</li>
                </ul>
            </div>';
        }

        ob_start();
        ?>
        <div class="ebook-container">
            <div class="ebook-header">
                <h2><?php echo esc_html($ebook_term->name); ?></h2>
                <?php if ($ebook_term->description): ?>
                    <p class="ebook-description"><?php echo esc_html($ebook_term->description); ?></p>
                <?php endif; ?>
                <div class="ebook-controls">
                    <button class="ebook-btn ebook-prev">Previous</button>
                    <span class="ebook-progress">
                        <span class="current-chapter">1</span> / <span
                            class="total-chapters"><?php echo count($chapters); ?></span>
                    </span>
                    <button class="ebook-btn ebook-next">Next</button>
                </div>
            </div>

            <div class="swiper ebook-slider" style="height: <?php echo esc_attr($atts['height']); ?>;">
                <div class="swiper-wrapper">
                    <?php foreach ($chapters as $index => $chapter): ?>
                        <?php
                        $audio_url = get_post_meta($chapter->ID, '_ebook_audio_url', true);
                        $chapter_order = get_post_meta($chapter->ID, '_ebook_chapter_order', true);
                        if (!$chapter_order) {
                            $chapter_order = $chapter->menu_order;
                        }
                        ?>
                        <div class="swiper-slide ebook-chapter" data-chapter="<?php echo $index + 1; ?>"
                            data-chapter-id="<?php echo $chapter->ID; ?>">
                            <div class="chapter-content">
                                <div class="chapter-header">
                                    <h3 class="chapter-title">
                                        <?php if ($chapter_order): ?>
                                            <span class="chapter-number">Chapter <?php echo $chapter_order; ?>:</span>
                                        <?php endif; ?>
                                        <?php echo esc_html($chapter->post_title); ?>
                                    </h3>

                                    <?php if ($audio_url): ?>
                                        <div class="audio-controls">
                                            <audio controls preload="none">
                                                <source src="<?php echo esc_url($audio_url); ?>" type="audio/mpeg">
                                                Your browser does not support the audio element.
                                            </audio>
                                            <button class="generate-audio-btn" data-chapter-id="<?php echo $chapter->ID; ?>">Regenerate
                                                Audio</button>
                                        </div>
                                    <?php else: ?>
                                        <div class="audio-controls">
                                            <button class="generate-audio-btn" data-chapter-id="<?php echo $chapter->ID; ?>">Generate
                                                Audio</button>
                                        </div>
                                    <?php endif; ?>
                                </div>

                                <div class="chapter-text">
                                    <?php
                                    // Apply content filters for proper formatting
                                    echo apply_filters('the_content', $chapter->post_content);
                                    ?>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <div class="ebook-pagination">
                <div class="swiper-pagination"></div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function convert_text_to_audio()
    {
        if (!wp_verify_nonce($_POST['nonce'], 'ebook_nonce')) {
            wp_die('Security check failed');
        }

        $chapter_id = intval($_POST['chapter_id']);
        $chapter = get_post($chapter_id);

        if (!$chapter || $chapter->post_type !== 'ebook_chapter') {
            wp_send_json_error('Chapter not found');
        }

        // Strip HTML tags from content
        $text = strip_tags($chapter->post_content);
        $text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
        $text = trim($text);

        if (empty($text)) {
            wp_send_json_error('No text content found in chapter');
        }

        // For demo purposes, we'll simulate audio generation
        // In production, you would integrate with actual text-to-speech services
        $audio_url = $this->generate_audio_simulation($text, $chapter_id);

        if ($audio_url) {
            update_post_meta($chapter_id, '_ebook_audio_url', $audio_url);

            wp_send_json_success(array(
                'audio_url' => $audio_url,
                'message' => 'Audio generated successfully!'
            ));
        } else {
            wp_send_json_error('Failed to generate audio');
        }
    }

    private function generate_audio_simulation($text, $chapter_id) {
    $openai_api_key = get_option('ebook_openai_api_key');
    if (empty($openai_api_key)) {
        error_log("❌ OpenAI API key not found.");
        return false;
    }

    // Limit text length to prevent API errors
    if (strlen($text) > 4096) {
        $text = substr($text, 0, 4096) . '...';
    }

    $upload_dir = wp_upload_dir();
    $audio_filename = 'chapter-' . $chapter_id . '-' . time() . '.mp3';
    $audio_path = $upload_dir['path'] . '/' . $audio_filename;
    $audio_url  = $upload_dir['url']  . '/' . $audio_filename;

    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => "https://api.openai.com/v1/audio/speech",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer " . $openai_api_key,
            "Content-Type: application/json"
        ],
        CURLOPT_POSTFIELDS => json_encode([
            "model" => "tts-1", // Correct model name
            "input" => $text,
            "voice" => "alloy",
            "response_format" => "mp3"
        ]),
        CURLOPT_TIMEOUT => 120,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response = curl_exec($curl);
    $http_code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    // Enhanced error handling
    if ($error) {
        error_log("❌ cURL Error: " . $error);
        return false;
    }

    if ($http_code === 200 && !empty($response)) {
        // Verify it's actually audio data
        $file_header = substr($response, 0, 4);
        if (strpos($file_header, 'ID3') === 0 || ord($file_header[0]) === 0xFF) {
            if (file_put_contents($audio_path, $response)) {
                return $audio_url;
            } else {
                error_log("❌ Failed to save audio file to: " . $audio_path);
            }
        } else {
            error_log("❌ Invalid audio response. First 100 chars: " . substr($response, 0, 100));
        }
    } else {
        $error_response = json_decode($response, true);
        $error_message = isset($error_response['error']['message']) ? $error_response['error']['message'] : $response;
        error_log("❌ OpenAI API Error (HTTP $http_code): " . $error_message);
    }

    return false;
}
// Add to your InteractiveEBookPlugin class
public function add_audio_settings_page() {
    add_submenu_page(
        'edit.php?post_type=ebook_chapter',
        'Audio Settings',
        'Audio Settings',
        'manage_options',
        'ebook-audio-settings',
        array($this, 'render_audio_settings_page')
    );
}

public function render_audio_settings_page() {
    if (isset($_POST['submit'])) {
        update_option('ebook_openai_api_key', sanitize_text_field($_POST['openai_api_key']));
        update_option('ebook_tts_voice', sanitize_text_field($_POST['tts_voice']));
        update_option('ebook_tts_model', sanitize_text_field($_POST['tts_model']));
        echo '<div class="notice notice-success"><p>Settings saved!</p></div>';
    }
    
    $api_key = get_option('ebook_openai_api_key', '');
    $voice = get_option('ebook_tts_voice', 'alloy');
    $model = get_option('ebook_tts_model', 'tts-1');
    
    ?>
    <div class="wrap">
        <h1>eBook Audio Settings</h1>
        
        <form method="post" action="">
            <table class="form-table">
                <tr>
                    <th scope="row">OpenAI API Key</th>
                    <td>
                        <input type="password" name="openai_api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                        <p class="description">Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Voice</th>
                    <td>
                        <select name="tts_voice">
                            <option value="alloy" <?php selected($voice, 'alloy'); ?>>Alloy</option>
                            <option value="echo" <?php selected($voice, 'echo'); ?>>Echo</option>
                            <option value="fable" <?php selected($voice, 'fable'); ?>>Fable</option>
                            <option value="onyx" <?php selected($voice, 'onyx'); ?>>Onyx</option>
                            <option value="nova" <?php selected($voice, 'nova'); ?>>Nova</option>
                            <option value="shimmer" <?php selected($voice, 'shimmer'); ?>>Shimmer</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row">TTS Model</th>
                    <td>
                        <select name="tts_model">
                            <option value="tts-1" <?php selected($model, 'tts-1'); ?>>TTS-1 (Standard)</option>
                            <option value="tts-1-hd" <?php selected($model, 'tts-1-hd'); ?>>TTS-1-HD (Higher Quality)</option>
                        </select>
                        <p class="description">TTS-1-HD provides higher quality but costs more</p>
                    </td>
                </tr>
            </table>
            
            <?php submit_button(); ?>
        </form>
        
        <h2>Test Audio Generation</h2>
        <button id="test-audio-generation" class="button">Test API Connection</button>
        <div id="test-results"></div>
    </div>
    
    <script>
    jQuery(document).ready(function($) {
        $('#test-audio-generation').click(function() {
            var $button = $(this);
            var $results = $('#test-results');
            
            $button.prop('disabled', true).text('Testing...');
            $results.html('<p>Testing API connection...</p>');
            
            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: {
                    action: 'test_audio_api',
                    nonce: '<?php echo wp_create_nonce('test_audio_api'); ?>'
                },
                success: function(response) {
                    if (response.success) {
                        $results.html('<div class="notice notice-success"><p>✅ API connection successful!</p></div>');
                    } else {
                        $results.html('<div class="notice notice-error"><p>❌ ' + response.data + '</p></div>');
                    }
                },
                complete: function() {
                    $button.prop('disabled', false).text('Test API Connection');
                }
            });
        });
    });
    </script>
    <?php
}

// AJAX handler for testing API
public function test_audio_api() {
    if (!wp_verify_nonce($_POST['nonce'], 'test_audio_api')) {
        wp_send_json_error('Security check failed');
    }
    
    $api_key = get_option('ebook_openai_api_key');
    if (empty($api_key)) {
        wp_send_json_error('No API key configured');
    }
    
    $test_result = $this->test_openai_connection($api_key);
    
    if ($test_result['success']) {
        wp_send_json_success('API connection successful');
    } else {
        wp_send_json_error('API connection failed: HTTP ' . $test_result['http_code']);
    }
}

    // Debug shortcode to check chapters
    public function debug_chapters($atts)
    {
        $atts = shortcode_atts(array(
            'ebook' => ''
        ), $atts);

        if (empty($atts['ebook'])) {
            return '<p>Please specify an ebook slug or ID.</p>';
        }

        // Get ebook term
        $ebook_term = null;
        if (is_numeric($atts['ebook'])) {
            $ebook_term = get_term($atts['ebook'], 'ebook');
        } else {
            $ebook_term = get_term_by('slug', $atts['ebook'], 'ebook');
        }

        $chapters = get_posts(array(
            'post_type' => 'ebook_chapter',
            'posts_per_page' => -1,
            'post_status' => array('publish', 'draft')
        ));

        $output = '<div class="ebook-debug">';
        $output .= '<h3>Debug Information</h3>';
        $output .= '<p><strong>eBook:</strong> ' . $atts['ebook'] . '</p>';
        $output .= '<p><strong>eBook Term:</strong> ' . ($ebook_term ? $ebook_term->name . ' (ID: ' . $ebook_term->term_id . ')' : 'Not found') . '</p>';
        $output .= '<p><strong>Total Chapters:</strong> ' . count($chapters) . '</p>';

        if ($ebook_term) {
            $ebook_chapters = get_posts(array(
                'post_type' => 'ebook_chapter',
                'posts_per_page' => -1,
                'tax_query' => array(
                    array(
                        'taxonomy' => 'ebook',
                        'field' => 'term_id',
                        'terms' => $ebook_term->term_id,
                    ),
                )
            ));
            $output .= '<p><strong>Chapters in this eBook:</strong> ' . count($ebook_chapters) . '</p>';
        }

        $output .= '<h4>All Chapters:</h4><ul>';
        foreach ($chapters as $chapter) {
            $chapter_ebooks = wp_get_object_terms($chapter->ID, 'ebook', array('fields' => 'names'));
            $chapter_order = get_post_meta($chapter->ID, '_ebook_chapter_order', true);
            $audio_url = get_post_meta($chapter->ID, '_ebook_audio_url', true);

            $output .= '<li>';
            $output .= '<strong>' . $chapter->post_title . '</strong> (ID: ' . $chapter->ID . ')';
            $output .= '<br>eBooks: ' . (empty($chapter_ebooks) ? 'None' : implode(', ', $chapter_ebooks));
            $output .= '<br>Order: ' . ($chapter_order ? $chapter_order : $chapter->menu_order);
            $output .= '<br>Status: ' . $chapter->post_status;
            $output .= '<br>Audio: ' . ($audio_url ? '✓' : '✗');
            $output .= '</li>';
        }
        $output .= '</ul>';

        // List all ebooks
        $all_ebooks = get_terms(array(
            'taxonomy' => 'ebook',
            'hide_empty' => false
        ));

        $output .= '<h4>All eBooks:</h4><ul>';
        foreach ($all_ebooks as $ebook) {
            $chapter_count = get_posts(array(
                'post_type' => 'ebook_chapter',
                'posts_per_page' => -1,
                'tax_query' => array(
                    array(
                        'taxonomy' => 'ebook',
                        'field' => 'term_id',
                        'terms' => $ebook->term_id,
                    ),
                ),
                'fields' => 'ids'
            ));

            $output .= '<li>' . $ebook->name . ' (ID: ' . $ebook->term_id . ', Slug: ' . $ebook->slug . ') - ' . count($chapter_count) . ' chapters</li>';
        }
        $output .= '</ul></div>';

        return $output;
    }

    public function activate()
    {
        $this->create_post_types();
        $this->create_taxonomies();
        flush_rewrite_rules();
    }
}

// Initialize the plugin
new InteractiveEBookPlugin();