<?php
/**
 * Plugin Name: Interactive eBook Plugin
 * Description: Create interactive eBooks with chapters displayed in sliders and text-to-audio conversion
 * Version: 1.0.0
 * Author: Your Name
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('EBOOK_PLUGIN_URL', plugin_dir_url(__FILE__));
define('EBOOK_PLUGIN_PATH', plugin_dir_path(__FILE__));

class InteractiveEBookPlugin {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post', array($this, 'save_meta_boxes'));
        add_shortcode('ebook_slider', array($this, 'ebook_slider_shortcode'));
        add_action('wp_ajax_convert_text_to_audio', array($this, 'convert_text_to_audio'));
        add_action('wp_ajax_nopriv_convert_text_to_audio', array($this, 'convert_text_to_audio'));
        add_action('wp_ajax_get_ebooks_list', array($this, 'get_ebooks_list'));
        add_action('wp_ajax_get_next_chapter_order', array($this, 'get_next_chapter_order'));
        add_action('wp_ajax_save_chapter_order', array($this, 'save_chapter_order'));
        add_shortcode('ebook_chapters_debug', array($this, 'debug_chapters'));
        register_activation_hook(__FILE__, array($this, 'activate'));
    }
    
    public function init() {
        $this->create_post_types();
        $this->create_taxonomies();
    }
    
    public function create_post_types() {
        // Register Books post type
        register_post_type('ebook', array(
            'labels' => array(
                'name' => 'eBooks',
                'singular_name' => 'eBook',
                'add_new' => 'Add New eBook',
                'add_new_item' => 'Add New eBook',
                'edit_item' => 'Edit eBook',
                'new_item' => 'New eBook',
                'view_item' => 'View eBook',
                'search_items' => 'Search eBooks',
                'not_found' => 'No eBooks found',
                'not_found_in_trash' => 'No eBooks found in trash'
            ),
            'public' => true,
            'has_archive' => true,
            'menu_icon' => 'dashicons-book',
            'supports' => array('title', 'editor', 'thumbnail', 'excerpt'),
            'rewrite' => array('slug' => 'ebooks')
        ));
        
        // Register Chapters post type
        register_post_type('ebook_chapter', array(
            'labels' => array(
                'name' => 'Chapters',
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
            'has_archive' => false,
            'menu_icon' => 'dashicons-media-document',
            'supports' => array('title', 'editor', 'page-attributes'),
            'rewrite' => array('slug' => 'chapters')
        ));
    }
    
    public function create_taxonomies() {
        // Create taxonomy to link chapters to books
        register_taxonomy('ebook_series', 'ebook_chapter', array(
            'hierarchical' => true,
            'labels' => array(
                'name' => 'eBook Series',
                'singular_name' => 'eBook Series',
            ),
            'show_ui' => true,
            'show_admin_column' => true,
            'query_var' => true,
            'rewrite' => array('slug' => 'ebook-series'),
        ));
    }
    
    public function enqueue_scripts() {
        wp_enqueue_script('jquery');
        wp_enqueue_script('swiper-js', 'https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.js', array(), '8.0.0', true);
        wp_enqueue_style('swiper-css', 'https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.css', array(), '8.0.0');
        
        wp_enqueue_script('ebook-plugin-js', EBOOK_PLUGIN_URL . 'assets/ebook-plugin.js', array('jquery', 'swiper-js'), '1.0.0', true);
        wp_enqueue_style('ebook-plugin-css', EBOOK_PLUGIN_URL . 'assets/ebook-plugin.css', array('swiper-css'), '1.0.0');
        
        wp_localize_script('ebook-plugin-js', 'ebook_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('ebook_nonce')
        ));
    }
    
    public function admin_enqueue_scripts() {
        wp_enqueue_script('ebook-admin-js', EBOOK_PLUGIN_URL . 'assets/ebook-admin.js', array('jquery'), '1.0.0', true);
        wp_enqueue_style('ebook-admin-css', EBOOK_PLUGIN_URL . 'assets/ebook-admin.css', array(), '1.0.0');
    }
    
    public function add_meta_boxes() {
        add_meta_box(
            'ebook_chapter_meta',
            'Chapter Details',
            array($this, 'chapter_meta_box_callback'),
            'ebook_chapter',
            'normal',
            'high'
        );
        
        add_meta_box(
            'ebook_meta',
            'eBook Details',
            array($this, 'ebook_meta_box_callback'),
            'ebook',
            'normal',
            'high'
        );
    }
    
    public function chapter_meta_box_callback($post) {
        wp_nonce_field('ebook_chapter_meta_nonce', 'ebook_chapter_meta_nonce');
        
        $book_id = get_post_meta($post->ID, '_ebook_book_id', true);
        $chapter_order = get_post_meta($post->ID, '_ebook_chapter_order', true);
        $audio_url = get_post_meta($post->ID, '_ebook_audio_url', true);
        
        $books = get_posts(array('post_type' => 'ebook', 'posts_per_page' => -1));
        
        echo '<table class="form-table">';
        echo '<tr><th><label for="ebook_book_id">Select eBook:</label></th><td>';
        echo '<select name="ebook_book_id" id="ebook_book_id">';
        echo '<option value="">Select a book...</option>';
        foreach ($books as $book) {
            $selected = ($book_id == $book->ID) ? 'selected' : '';
            echo '<option value="' . $book->ID . '" ' . $selected . '>' . $book->post_title . '</option>';
        }
        echo '</select></td></tr>';
        
        echo '<tr><th><label for="ebook_chapter_order">Chapter Order:</label></th><td>';
        echo '<input type="number" name="ebook_chapter_order" id="ebook_chapter_order" value="' . $chapter_order . '" min="1" /></td></tr>';
        
        echo '<tr><th><label for="ebook_audio_url">Audio URL:</label></th><td>';
        echo '<input type="url" name="ebook_audio_url" id="ebook_audio_url" value="' . $audio_url . '" style="width: 100%;" />';
        echo '<br><button type="button" id="generate_audio" class="button">Generate Audio from Content</button></td></tr>';
        
        echo '</table>';
    }
    
    public function ebook_meta_box_callback($post) {
        wp_nonce_field('ebook_meta_nonce', 'ebook_meta_nonce');
        
        $author = get_post_meta($post->ID, '_ebook_author', true);
        $isbn = get_post_meta($post->ID, '_ebook_isbn', true);
        $publication_date = get_post_meta($post->ID, '_ebook_publication_date', true);
        
        echo '<table class="form-table">';
        echo '<tr><th><label for="ebook_author">Author:</label></th><td>';
        echo '<input type="text" name="ebook_author" id="ebook_author" value="' . $author . '" style="width: 100%;" /></td></tr>';
        
        echo '<tr><th><label for="ebook_isbn">ISBN:</label></th><td>';
        echo '<input type="text" name="ebook_isbn" id="ebook_isbn" value="' . $isbn . '" /></td></tr>';
        
        echo '<tr><th><label for="ebook_publication_date">Publication Date:</label></th><td>';
        echo '<input type="date" name="ebook_publication_date" id="ebook_publication_date" value="' . $publication_date . '" /></td></tr>';
        
        echo '</table>';
    }
    
    public function save_meta_boxes($post_id) {
        if (!isset($_POST['ebook_chapter_meta_nonce']) && !isset($_POST['ebook_meta_nonce'])) {
            return;
        }
        
        if (isset($_POST['ebook_chapter_meta_nonce'])) {
            if (!wp_verify_nonce($_POST['ebook_chapter_meta_nonce'], 'ebook_chapter_meta_nonce')) {
                return;
            }
            
            if (isset($_POST['ebook_book_id'])) {
                update_post_meta($post_id, '_ebook_book_id', sanitize_text_field($_POST['ebook_book_id']));
            }
            
            if (isset($_POST['ebook_chapter_order'])) {
                update_post_meta($post_id, '_ebook_chapter_order', intval($_POST['ebook_chapter_order']));
            }
            
            if (isset($_POST['ebook_audio_url'])) {
                update_post_meta($post_id, '_ebook_audio_url', esc_url($_POST['ebook_audio_url']));
            }
        }
        
        if (isset($_POST['ebook_meta_nonce'])) {
            if (!wp_verify_nonce($_POST['ebook_meta_nonce'], 'ebook_meta_nonce')) {
                return;
            }
            
            if (isset($_POST['ebook_author'])) {
                update_post_meta($post_id, '_ebook_author', sanitize_text_field($_POST['ebook_author']));
            }
            
            if (isset($_POST['ebook_isbn'])) {
                update_post_meta($post_id, '_ebook_isbn', sanitize_text_field($_POST['ebook_isbn']));
            }
            
            if (isset($_POST['ebook_publication_date'])) {
                update_post_meta($post_id, '_ebook_publication_date', sanitize_text_field($_POST['ebook_publication_date']));
            }
        }
    }
    
    public function ebook_slider_shortcode($atts) {
        $atts = shortcode_atts(array(
            'book_id' => '',
            'height' => '500px'
        ), $atts);
        
        if (empty($atts['book_id'])) {
            return '<p>Please specify a book ID for the slider.</p>';
        }
        
        // Debug: Check if book exists
        $book = get_post($atts['book_id']);
        if (!$book || $book->post_type !== 'ebook') {
            return '<p>Invalid book ID or book not found.</p>';
        }
        
        // Try multiple methods to find chapters
        $chapters = array();
        
        // Method 1: Query by meta value
        $chapters = get_posts(array(
            'post_type' => 'ebook_chapter',
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'meta_query' => array(
                array(
                    'key' => '_ebook_book_id',
                    'value' => $atts['book_id'],
                    'compare' => '='
                )
            ),
            'meta_key' => '_ebook_chapter_order',
            'orderby' => 'meta_value_num',
            'order' => 'ASC'
        ));
        
        // Method 2: If no chapters found, try without meta_key ordering
        if (empty($chapters)) {
            $chapters = get_posts(array(
                'post_type' => 'ebook_chapter',
                'posts_per_page' => -1,
                'post_status' => 'publish',
                'meta_query' => array(
                    array(
                        'key' => '_ebook_book_id',
                        'value' => $atts['book_id'],
                        'compare' => '='
                    )
                ),
                'orderby' => 'menu_order',
                'order' => 'ASC'
            ));
        }
        
        // Method 3: If still no chapters, get all chapters and filter
        if (empty($chapters)) {
            $all_chapters = get_posts(array(
                'post_type' => 'ebook_chapter',
                'posts_per_page' => -1,
                'post_status' => 'publish'
            ));
            
            foreach ($all_chapters as $chapter) {
                $chapter_book_id = get_post_meta($chapter->ID, '_ebook_book_id', true);
                if ($chapter_book_id == $atts['book_id']) {
                    $chapters[] = $chapter;
                }
            }
        }
        
        // Debug information
        $debug_info = '';
        if (defined('WP_DEBUG') && WP_DEBUG) {
            $debug_info = '<!-- Debug: Book ID: ' . $atts['book_id'] . ', Chapters found: ' . count($chapters) . ' -->';
        }
        
        if (empty($chapters)) {
            return $debug_info . '<div class="ebook-no-chapters">
                <h3>No chapters found for this book.</h3>
                <p>Please check:</p>
                <ul>
                    <li>Chapters are published</li>
                    <li>Chapters are assigned to this book (ID: ' . esc_html($atts['book_id']) . ')</li>
                    <li>Book ID is correct</li>
                </ul>
                <p><strong>Book:</strong> ' . esc_html($book->post_title) . '</p>
            </div>';
        }
        
        $book = get_post($atts['book_id']);
        
        ob_start();
        ?>
        <div class="ebook-container">
            <div class="ebook-header">
                <h2><?php echo esc_html($book->post_title); ?></h2>
                <div class="ebook-controls">
                    <button class="ebook-btn ebook-prev">Previous</button>
                    <span class="ebook-progress">
                        <span class="current-chapter">1</span> / <span class="total-chapters"><?php echo count($chapters); ?></span>
                    </span>
                    <button class="ebook-btn ebook-next">Next</button>
                </div>
            </div>
            
            <div class="swiper ebook-slider" style="height: <?php echo esc_attr($atts['height']); ?>;">
                <div class="swiper-wrapper">
                    <?php foreach ($chapters as $index => $chapter): ?>
                        <?php
                        $audio_url = get_post_meta($chapter->ID, '_ebook_audio_url', true);
                        ?>
                        <div class="swiper-slide ebook-chapter" data-chapter="<?php echo $index + 1; ?>">
                            <div class="chapter-content">
                                <h3 class="chapter-title"><?php echo esc_html($chapter->post_title); ?></h3>
                                
                                <?php if ($audio_url): ?>
                                <div class="audio-controls">
                                    <audio controls preload="none">
                                        <source src="<?php echo esc_url($audio_url); ?>" type="audio/mpeg">
                                        Your browser does not support the audio element.
                                    </audio>
                                    <button class="generate-audio-btn" data-chapter-id="<?php echo $chapter->ID; ?>">Regenerate Audio</button>
                                </div>
                                <?php else: ?>
                                <div class="audio-controls">
                                    <button class="generate-audio-btn" data-chapter-id="<?php echo $chapter->ID; ?>">Generate Audio</button>
                                </div>
                                <?php endif; ?>
                                
                                <div class="chapter-text">
                                    <?php echo wp_kses_post($chapter->post_content); ?>
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
    
    public function convert_text_to_audio() {
        if (!wp_verify_nonce($_POST['nonce'], 'ebook_nonce')) {
            wp_die('Security check failed');
        }
        
        $chapter_id = intval($_POST['chapter_id']);
        $chapter = get_post($chapter_id);
        
        if (!$chapter) {
            wp_send_json_error('Chapter not found');
        }
        
        // Strip HTML tags from content
        $text = strip_tags($chapter->post_content);
        $text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
        
        // For demo purposes, we'll use a simple text-to-speech API
        // In production, you might use services like AWS Polly, Google Text-to-Speech, etc.
        
        // Simulate audio generation (replace with actual API call)
        $audio_data = $this->generate_audio_simulation($text);
        
        if ($audio_data) {
            // Save audio file
            $upload_dir = wp_upload_dir();
            $audio_filename = 'chapter-' . $chapter_id . '-' . time() . '.mp3';
            $audio_path = $upload_dir['path'] . '/' . $audio_filename;
            $audio_url = $upload_dir['url'] . '/' . $audio_filename;
            
            // In a real implementation, you would save the actual audio data
            // file_put_contents($audio_path, $audio_data);
            
            // For demo, we'll just save a placeholder URL
            update_post_meta($chapter_id, '_ebook_audio_url', $audio_url);
            
            wp_send_json_success(array(
                'audio_url' => $audio_url,
                'message' => 'Audio generated successfully!'
            ));
        } else {
            wp_send_json_error('Failed to generate audio');
        }
    }
    
    private function generate_audio_simulation($text) {
        // This is a simulation function
        // In a real implementation, you would integrate with actual text-to-speech services
        
        // Example with AWS Polly (requires AWS SDK):
        /*
        try {
            $polly = new Aws\Polly\PollyClient([
                'version' => 'latest',
                'region' => 'us-west-2'
            ]);
            
            $result = $polly->synthesizeSpeech([
                'Text' => $text,
                'OutputFormat' => 'mp3',
                'VoiceId' => 'Joanna'
            ]);
            
            return $result['AudioStream']->getContents();
        } catch (Exception $e) {
            return false;
        }
        */
        
        // For demo purposes, return true to simulate success
        return true;
    }
    
    public function activate() {
        $this->create_post_types();
        flush_rewrite_rules();
    }
    
    // AJAX handler for getting ebooks list
    public function get_ebooks_list() {
        if (!wp_verify_nonce($_POST['nonce'], 'ebook_nonce')) {
            wp_die('Security check failed');
        }
        
        $books = get_posts(array(
            'post_type' => 'ebook',
            'posts_per_page' => -1,
            'post_status' => 'publish'
        ));
        
        wp_send_json_success(array('books' => $books));
    }
    
    // AJAX handler for getting next chapter order
    public function get_next_chapter_order() {
        if (!wp_verify_nonce($_POST['nonce'], 'ebook_nonce')) {
            wp_die('Security check failed');
        }
        
        $book_id = intval($_POST['book_id']);
        
        $chapters = get_posts(array(
            'post_type' => 'ebook_chapter',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_ebook_book_id',
                    'value' => $book_id,
                    'compare' => '='
                )
            )
        ));
        
        $next_order = count($chapters) + 1;
        
        wp_send_json_success(array('next_order' => $next_order));
    }
    
    // AJAX handler for saving chapter order
    public function save_chapter_order() {
        if (!wp_verify_nonce($_POST['nonce'], 'ebook_nonce')) {
            wp_die('Security check failed');
        }
        
        $post_id = intval($_POST['post_id']);
        $order = intval($_POST['order']);
        
        update_post_meta($post_id, '_ebook_chapter_order', $order);
        
        wp_send_json_success(array('message' => 'Order saved'));
    }
    
    // Debug shortcode to check chapters
    public function debug_chapters($atts) {
        $atts = shortcode_atts(array(
            'book_id' => ''
        ), $atts);
        
        if (empty($atts['book_id'])) {
            return '<p>Please specify a book ID.</p>';
        }
        
        $book = get_post($atts['book_id']);
        $chapters = get_posts(array(
            'post_type' => 'ebook_chapter',
            'posts_per_page' => -1,
            'post_status' => array('publish', 'draft')
        ));
        
        $output = '<div class="ebook-debug">';
        $output .= '<h3>Debug Information</h3>';
        $output .= '<p><strong>Book ID:</strong> ' . $atts['book_id'] . '</p>';
        $output .= '<p><strong>Book Title:</strong> ' . ($book ? $book->post_title : 'Not found') . '</p>';
        $output .= '<p><strong>Total Chapters:</strong> ' . count($chapters) . '</p>';
        
        $output .= '<h4>All Chapters:</h4><ul>';
        foreach ($chapters as $chapter) {
            $chapter_book_id = get_post_meta($chapter->ID, '_ebook_book_id', true);
            $chapter_order = get_post_meta($chapter->ID, '_ebook_chapter_order', true);
            $assigned = ($chapter_book_id == $atts['book_id']) ? '✓' : '✗';
            
            $output .= '<li>' . $assigned . ' ' . $chapter->post_title . ' (ID: ' . $chapter->ID . ', Book ID: ' . $chapter_book_id . ', Order: ' . $chapter_order . ', Status: ' . $chapter->post_status . ')</li>';
        }
        $output .= '</ul></div>';
        
        return $output;
    }
}

// Initialize the plugin
new InteractiveEBookPlugin();