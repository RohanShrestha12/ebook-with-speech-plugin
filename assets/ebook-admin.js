// EBook Plugin Admin JavaScript
jQuery(document).ready(function($) {
    
    // Generate audio functionality in admin
    $('#generate_audio').on('click', function(e) {
        e.preventDefault();
        
        const $btn = $(this);
        const postId = $('#post_ID').val();
        
        if (!postId) {
            alert('Please save the post first');
            return;
        }
        
        $btn.prop('disabled', true).text('Generating Audio...');
        
        // Get the content from the editor
        let content = '';
        if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
            content = tinymce.get('content').getContent();
        } else {
            content = $('#content').val();
        }
        
        if (!content.trim()) {
            alert('Please add content first');
            $btn.prop('disabled', false).text('Generate Audio from Content');
            return;
        }
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'convert_text_to_audio',
                chapter_id: postId,
                nonce: $('#ebook_chapter_meta_nonce').val()
            },
            success: function(response) {
                if (response.success) {
                    $('#ebook_audio_url').val(response.data.audio_url);
                    showAdminNotice('Audio generated successfully!', 'success');
                } else {
                    showAdminNotice(response.data || 'Failed to generate audio', 'error');
                }
                $btn.prop('disabled', false).text('Generate Audio from Content');
            },
            error: function() {
                showAdminNotice('An error occurred while generating audio', 'error');
                $btn.prop('disabled', false).text('Generate Audio from Content');
            }
        });
    });
    
    // Show admin notice
    function showAdminNotice(message, type) {
        const noticeClass = type === 'success' ? 'notice-success' : 'notice-error';
        const notice = $(`
            <div class="notice ${noticeClass} is-dismissible">
                <p>${message}</p>
                <button type="button" class="notice-dismiss">
                    <span class="screen-reader-text">Dismiss this notice.</span>
                </button>
            </div>
        `);
        
        $('.wrap h1').after(notice);
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            notice.fadeOut(() => notice.remove());
        }, 5000);
        
        // Manual dismiss
        notice.find('.notice-dismiss').on('click', function() {
            notice.fadeOut(() => notice.remove());
        });
    }
    
    // Auto-save chapter order when changed
    $('#ebook_chapter_order').on('change', function() {
        const order = $(this).val();
        const postId = $('#post_ID').val();
        
        if (postId && order) {
            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: {
                    action: 'save_chapter_order',
                    post_id: postId,
                    order: order,
                    nonce: $('#ebook_chapter_meta_nonce').val()
                },
                success: function(response) {
                    if (response.success) {
                        showAdminNotice('Chapter order saved', 'success');
                    }
                }
            });
        }
    });
    
    // Book selection change handler
    $('#ebook_book_id').on('change', function() {
        const bookId = $(this).val();
        const postId = $('#post_ID').val();
        
        if (postId && bookId) {
            // Update chapter order suggestions based on existing chapters
            updateChapterOrderSuggestion(bookId);
        }
    });
    
    // Update chapter order suggestion
    function updateChapterOrderSuggestion(bookId) {
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'get_next_chapter_order',
                book_id: bookId,
                nonce: $('#ebook_chapter_meta_nonce').val()
            },
            success: function(response) {
                if (response.success) {
                    const suggestedOrder = response.data.next_order;
                    const $orderField = $('#ebook_chapter_order');
                    
                    if (!$orderField.val()) {
                        $orderField.val(suggestedOrder);
                        $orderField.after(`<small class="description">Suggested order: ${suggestedOrder}</small>`);
                    }
                }
            }
        });
    }
    
    // Bulk operations for chapters
    $('.tablenav .actions select[name="action"]').after(`
        <select name="bulk_book_id" style="display:none;">
            <option value="">Select Book...</option>
        </select>
    `);
    
    // Load books for bulk operations
    loadBooksForBulkOperations();
    
    function loadBooksForBulkOperations() {
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'get_ebooks_list',
                nonce: $('#ebook_chapter_meta_nonce').val()
            },
            success: function(response) {
                if (response.success) {
                    let options = '<option value="">Select Book...</option>';
                    response.data.books.forEach(book => {
                        options += `<option value="${book.ID}">${book.post_title}</option>`;
                    });
                    $('select[name="bulk_book_id"]').html(options);
                }
            }
        });
    }
    
    // Handle bulk action changes
    $('.tablenav .actions select[name="action"]').on('change', function() {
        const action = $(this).val();
        const $bulkBookSelect = $('select[name="bulk_book_id"]');
        
        if (action === 'assign_to_book') {
            $bulkBookSelect.show();
        } else {
            $bulkBookSelect.hide();
        }
    });
    
    // Chapter reordering functionality
    if ($('.wp-list-table tbody').length) {
        $('.wp-list-table tbody').sortable({
            items: 'tr',
            cursor: 'move',
            axis: 'y',
            handle: '.column-title',
            helper: function(e, ui) {
                ui.children().each(function() {
                    $(this).width($(this).width());
                });
                return ui;
            },
            update: function(event, ui) {
                const order = [];
                $(this).find('tr').each(function(index) {
                    const postId = $(this).find('input[type="checkbox"]').val();
                    if (postId) {
                        order.push({
                            id: postId,
                            order: index + 1
                        });
                    }
                });
                
                updateChapterOrder(order);
            }
        });
        
        // Add visual indicator for sortable rows
        $('.wp-list-table tbody tr').css('cursor', 'move');
        $('.wp-list-table .column-title').prepend('<span class="dashicons dashicons-menu" style="margin-right: 5px; color: #ccc;"></span>');
    }
    
    function updateChapterOrder(order) {
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'update_chapters_order',
                order: order,
                nonce: $('#ebook_chapter_meta_nonce').val()
            },
            success: function(response) {
                if (response.success) {
                    showAdminNotice('Chapter order updated', 'success');
                } else {
                    showAdminNotice('Failed to update chapter order', 'error');
                }
            },
            error: function() {
                showAdminNotice('Error updating chapter order', 'error');
            }
        });
    }
    
    // Preview chapter functionality
    $(document).on('click', '.preview-chapter', function(e) {
        e.preventDefault();
        const chapterId = $(this).data('chapter-id');
        const bookId = $(this).data('book-id');
        
        if (!chapterId || !bookId) return;
        
        // Open preview in new window
        const previewUrl = `${window.location.origin}${window.location.pathname}?post=${bookId}&action=edit&preview_chapter=${chapterId}`;
        window.open(previewUrl, '_blank');
    });
    
    // Add preview buttons to chapter list
    $('.wp-list-table .column-title').each(function() {
        const $titleColumn = $(this);
        const $editLink = $titleColumn.find('.row-actions .edit a');
        
        if ($editLink.length) {
            const editUrl = $editLink.attr('href');
            const postMatch = editUrl.match(/post=(\d+)/);
            
            if (postMatch) {
                const chapterId = postMatch[1];
                const bookId = $titleColumn.closest('tr').find('input[name="book_id"]').val();
                
                $titleColumn.find('.row-actions').append(`
                    | <span class="preview">
                        <a href="#" class="preview-chapter" data-chapter-id="${chapterId}" data-book-id="${bookId}">Preview</a>
                    </span>
                `);
            }
        }
    });
    
    // Word count and reading time calculator
    function calculateWordCount() {
        let content = '';
        if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
            content = tinymce.get('content').getContent({format: 'text'});
        } else {
            content = $('#content').val().replace(/<[^>]*>/g, '');
        }
        
        const words = content.trim().split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const readingTime = Math.ceil(wordCount / 200); // Average reading speed: 200 words per minute
        
        updateWordCountDisplay(wordCount, readingTime);
    }
    
    function updateWordCountDisplay(wordCount, readingTime) {
        let $statsDiv = $('#chapter-stats');
        
        if (!$statsDiv.length) {
            $statsDiv = $('<div id="chapter-stats" class="postbox"><div class="inside"></div></div>');
            $('#side-sortables').prepend($statsDiv);
        }
        
        $statsDiv.find('.inside').html(`
            <h4>Chapter Statistics</h4>
            <p><strong>Word Count:</strong> ${wordCount}</p>
            <p><strong>Estimated Reading Time:</strong> ${readingTime} minute${readingTime !== 1 ? 's' : ''}</p>
        `);
    }
    
    // Calculate word count on content change
    if ($('#content').length) {
        // For classic editor
        $('#content').on('input', function() {
            clearTimeout($(this).data('timeout'));
            $(this).data('timeout', setTimeout(calculateWordCount, 500));
        });
        
        // For TinyMCE editor
        $(document).on('tinymce-editor-init', function(event, editor) {
            if (editor.id === 'content') {
                editor.on('keyup change', function() {
                    clearTimeout(editor.wordCountTimeout);
                    editor.wordCountTimeout = setTimeout(calculateWordCount, 500);
                });
            }
        });
        
        // Initial calculation
        setTimeout(calculateWordCount, 1000);
    }
    
    // Audio quality settings
    if ($('#ebook_audio_url').length) {
        $('#ebook_audio_url').after(`
            <div class="audio-settings" style="margin-top: 10px;">
                <label>
                    <strong>Audio Settings:</strong>
                </label>
                <br>
                <label>
                    <input type="radio" name="audio_voice" value="male" checked> Male Voice
                </label>
                <label style="margin-left: 15px;">
                    <input type="radio" name="audio_voice" value="female"> Female Voice
                </label>
                <br>
                <label style="margin-top: 10px; display: block;">
                    Speed: <input type="range" name="audio_speed" min="0.5" max="2" step="0.1" value="1" style="margin: 0 10px;">
                    <span class="speed-display">1x</span>
                </label>
            </div>
        `);
        
        // Update speed display
        $('input[name="audio_speed"]').on('input', function() {
            $('.speed-display').text($(this).val() + 'x');
        });
    }
    
    // Shortcode generator
    if ($('.post-type-ebook').length) {
        $('#titlediv').after(`
            <div class="postbox">
                <div class="postbox-header">
                    <h2 class="hndle">Shortcode Generator</h2>
                </div>
                <div class="inside">
                    <p>Use this shortcode to display the eBook slider:</p>
                    <code class="shortcode-display">[ebook_slider book_id="${$('#post_ID').val()}" height="500px"]</code>
                    <button type="button" class="button copy-shortcode" style="margin-left: 10px;">Copy</button>
                    <div class="shortcode-options" style="margin-top: 15px;">
                        <label>
                            Height: <input type="text" class="shortcode-height" value="500px" style="width: 100px;">
                        </label>
                        <button type="button" class="button update-shortcode">Update Shortcode</button>
                    </div>
                </div>
            </div>
        `);
        
        // Update shortcode
        $(document).on('click', '.update-shortcode', function() {
            const postId = $('#post_ID').val();
            const height = $('.shortcode-height').val();
            const shortcode = `[ebook_slider book_id="${postId}" height="${height}"]`;
            $('.shortcode-display').text(shortcode);
        });
        
        // Copy shortcode
        $(document).on('click', '.copy-shortcode', function() {
            const shortcode = $('.shortcode-display').text();
            navigator.clipboard.writeText(shortcode).then(function() {
                showAdminNotice('Shortcode copied to clipboard!', 'success');
            });
        });
    }
    
    // Chapter template selector
    if ($('#post-type-ebook_chapter').length || $('.post-type-ebook_chapter').length) {
        $('#titlediv').after(`
            <div class="postbox">
                <div class="postbox-header">
                    <h2 class="hndle">Chapter Template</h2>
                </div>
                <div class="inside">
                    <select id="chapter-template" style="width: 100%;">
                        <option value="">Select a template...</option>
                        <option value="introduction">Introduction Chapter</option>
                        <option value="content">Content Chapter</option>
                        <option value="conclusion">Conclusion Chapter</option>
                        <option value="appendix">Appendix</option>
                    </select>
                    <button type="button" class="button apply-template" style="margin-top: 10px;">Apply Template</button>
                </div>
            </div>
        `);
        
        // Apply chapter template
        $(document).on('click', '.apply-template', function() {
            const template = $('#chapter-template').val();
            if (!template) {
                alert('Please select a template first');
                return;
            }
            
            const templates = {
                introduction: {
                    title: 'Introduction',
                    content: '<h2>Welcome</h2><p>This introductory chapter sets the stage for...</p><h3>What You Will Learn</h3><p>In this book, you will discover...</p>'
                },
                content: {
                    title: 'Chapter Title',
                    content: '<h2>Overview</h2><p>This chapter covers...</p><h3>Key Points</h3><ul><li>Point 1</li><li>Point 2</li><li>Point 3</li></ul><h3>Summary</h3><p>In summary...</p>'
                },
                conclusion: {
                    title: 'Conclusion',
                    content: '<h2>Summary</h2><p>Throughout this book, we have explored...</p><h3>Key Takeaways</h3><ul><li>Takeaway 1</li><li>Takeaway 2</li><li>Takeaway 3</li></ul><h3>Next Steps</h3><p>Now that you have completed this book...</p>'
                },
                appendix: {
                    title: 'Appendix',
                    content: '<h2>Additional Resources</h2><p>This appendix contains supplementary information...</p><h3>References</h3><ul><li>Reference 1</li><li>Reference 2</li></ul>'
                }
            };
            
            const selectedTemplate = templates[template];
            
            if (confirm('This will replace the current title and content. Are you sure?')) {
                $('#title').val(selectedTemplate.title);
                
                if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
                    tinymce.get('content').setContent(selectedTemplate.content);
                } else {
                    $('#content').val(selectedTemplate.content);
                }
                
                showAdminNotice('Template applied successfully!', 'success');
            }
        });
    }
    
});