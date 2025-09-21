/* ebook-admin.js - Admin JavaScript */

jQuery(document).ready(function($) {
    
    // Add New eBook Functionality
    $('#add_new_ebook').on('click', function(e) {
        e.preventDefault();
        
        const $btn = $(this);
        const $input = $('#new_ebook_name');
        const ebookName = $input.val().trim();
        
        if (!ebookName) {
            alert('Please enter an eBook name.');
            $input.focus();
            return;
        }
        
        // Disable button and show loading
        $btn.prop('disabled', true).addClass('loading');
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'add_new_ebook',
                ebook_name: ebookName,
                nonce: ebook_admin_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    // Add new radio button option
                    const termId = response.data.term_id;
                    const termName = response.data.name;
                    
                    // Uncheck existing radio buttons
                    $('input[name="tax_input[ebook][]"]').prop('checked', false);
                    
                    // Add new option and select it
                    const newOption = `
                        <li>
                            <label>
                                <input type="radio" name="tax_input[ebook][]" value="${termId}" checked> 
                                ${termName}
                            </label>
                        </li>
                    `;
                    $('#ebookchecklist').append(newOption);
                    
                    // Clear input
                    $input.val('');
                    
                    showAdminNotice('eBook "' + termName + '" created successfully!', 'success');
                } else {
                    showAdminNotice(response.data || 'Failed to create eBook', 'error');
                }
            },
            error: function() {
                showAdminNotice('Failed to create eBook. Please try again.', 'error');
            },
            complete: function() {
                $btn.prop('disabled', false).removeClass('loading');
            }
        });
    });
    
    // Enter key support for new ebook input
    $('#new_ebook_name').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            $('#add_new_ebook').click();
        }
    });
    
    // Audio Generation in Admin
    $('#generate_audio').on('click', function(e) {
        e.preventDefault();
        
        const $btn = $(this);
        const chapterId = $btn.data('chapter-id') || $('input[name="post_ID"]').val();
        const $status = $('#audio-generation-status');
        
        if (!chapterId) {
            showAdminNotice('Error: Chapter ID not found', 'error');
            return;
        }
        
        // Check if there's content to convert
        const content = getChapterContent();
        if (!content.trim()) {
            showAdminNotice('Please add some content to the chapter before generating audio.', 'warning');
            return;
        }
        
        // Show loading state
        $btn.prop('disabled', true).addClass('loading');
        $status.removeClass('success error').addClass('loading')
               .text('Generating audio from chapter content...').show();
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'convert_text_to_audio',
                chapter_id: chapterId,
                nonce: ebook_admin_ajax.nonce
            },
            timeout: 120000, // 2 minute timeout for admin
            success: function(response) {
                if (response.success) {
                    $status.removeClass('loading error').addClass('success')
                           .text(response.data.message || 'Audio generated successfully!');
                    
                    // Update the audio URL field if it exists
                    if (response.data.audio_url) {
                        $('#ebook_audio_url').val(response.data.audio_url);
                    }
                    
                    // Update current audio display
                    updateAudioDisplay(response.data.audio_url);
                    
                    showAdminNotice('Audio generated successfully!', 'success');
                } else {
                    $status.removeClass('loading success').addClass('error')
                           .text(response.data || 'Failed to generate audio');
                    showAdminNotice(response.data || 'Failed to generate audio', 'error');
                }
            },
            error: function(xhr, status, error) {
                let errorMessage = 'Failed to generate audio';
                
                if (status === 'timeout') {
                    errorMessage = 'Request timed out. The audio generation may still be processing.';
                } else if (xhr.responseJSON && xhr.responseJSON.data) {
                    errorMessage = xhr.responseJSON.data;
                }
                
                $status.removeClass('loading success').addClass('error').text(errorMessage);
                showAdminNotice(errorMessage, 'error');
            },
            complete: function() {
                $btn.prop('disabled', false).removeClass('loading');
                
                // Hide status after 10 seconds
                setTimeout(function() {
                    $status.fadeOut();
                }, 10000);
            }
        });
    });
    
    // Auto-suggest chapter order
    $('#ebook_book_id, input[name="tax_input[ebook][]"]:checked').on('change', function() {
        const selectedEbook = getSelectedEbook();
        
        if (selectedEbook && !$('#ebook_chapter_order').val()) {
            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: {
                    action: 'get_next_chapter_order',
                    ebook_id: selectedEbook,
                    nonce: ebook_admin_ajax.nonce
                },
                success: function(response) {
                    if (response.success && response.data.next_order) {
                        $('#ebook_chapter_order').val(response.data.next_order);
                        $('#ebook_chapter_order').effect('highlight', {color: '#ffffaa'}, 1000);
                    }
                }
            });
        }
    });
    
    // Chapter order validation
    $('#ebook_chapter_order').on('blur', function() {
        const order = parseInt($(this).val());
        if (order < 1) {
            $(this).val(1);
            showAdminNotice('Chapter order cannot be less than 1.', 'warning');
        }
    });
    
    // Real-time chapter count update
    function updateChapterCount() {
        const selectedEbook = getSelectedEbook();
        
        if (selectedEbook) {
            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: {
                    action: 'get_chapter_count',
                    ebook_id: selectedEbook,
                    nonce: ebook_admin_ajax.nonce
                },
                success: function(response) {
                    if (response.success) {
                        const count = response.data.count;
                        const $info = $('.chapter-count-info');
                        
                        if ($info.length) {
                            $info.text(`(${count} chapters)`);
                        } else {
                            const selectedLabel = $('input[name="tax_input[ebook][]"]:checked').parent();
                            selectedLabel.append(` <span class="chapter-count-info">(${count} chapters)</span>`);
                        }
                    }
                }
            });
        }
    }
    
    // URL validation for audio field
    $('#ebook_audio_url').on('blur', function() {
        const url = $(this).val().trim();
        if (url && !isValidUrl(url)) {
            showAdminNotice('Please enter a valid audio URL.', 'warning');
            $(this).focus();
        }
    });
    
    // Bulk operations for admin list
    if ($('.wp-list-table').length) {
        // Add bulk regenerate audio option
        $('<option>').val('regenerate_audio').text('Regenerate Audio').appendTo('#bulk-action-selector-top, #bulk-action-selector-bottom');
        
        // Handle bulk actions
        $(document).on('click', '#doaction, #doaction2', function(e) {
            const action = $(this).siblings('select').val();
            
            if (action === 'regenerate_audio') {
                const selectedItems = $('input[name="post[]"]:checked').length;
                
                if (selectedItems === 0) {
                    e.preventDefault();
                    alert('Please select chapters to regenerate audio for.');
                    return;
                }
                
                const confirm = window.confirm(`Are you sure you want to regenerate audio for ${selectedItems} chapter(s)? This may take several minutes.`);
                if (!confirm) {
                    e.preventDefault();
                }
            }
        });
    }
    
    // Help tooltips
    $('<span class="help-tip" title="Enter a number to set the order of this chapter within the eBook. Lower numbers appear first.">?</span>')
        .insertAfter('label[for="ebook_chapter_order"]');
    
    $('.help-tip').tooltip({
        position: { my: "left+15 center", at: "right center" },
        tooltipClass: "ui-tooltip-help"
    });
    
    // Auto-save draft functionality
    let autoSaveTimeout;
    $('#title, #content').on('input', function() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(function() {
            $('#save-post').click();
        }, 30000); // Auto-save after 30 seconds of inactivity
    });
    
    // Initialize
    setTimeout(function() {
        updateChapterCount();
        
        // Show helpful tips for new users
        if (!localStorage.getItem('ebook_admin_tips_shown')) {
            showAdminTips();
            localStorage.setItem('ebook_admin_tips_shown', 'true');
        }
    }, 1000);
    
    // Utility Functions
    function getSelectedEbook() {
        const checkedRadio = $('input[name="tax_input[ebook][]"]:checked');
        return checkedRadio.length ? checkedRadio.val() : null;
    }
    
    function getChapterContent() {
        // Try to get content from different editors
        if (typeof tinyMCE !== 'undefined' && tinyMCE.get('content')) {
            return tinyMCE.get('content').getContent();
        } else if ($('#content').length) {
            return $('#content').val();
        }
        return '';
    }
    
    function updateAudioDisplay(audioUrl) {
        const $audioControls = $('.audio-meta-box .current-audio');
        
        if (audioUrl) {
            if ($audioControls.length) {
                $audioControls.find('audio source').attr('src', audioUrl);
                $audioControls.find('audio')[0].load();
            } else {
                const audioHtml = `
                    <div class="current-audio">
                        <label><strong>Current Audio:</strong></label><br>
                        <audio controls preload="metadata" style="width: 100%; margin: 10px 0;">
                            <source src="${audioUrl}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>
                        <p><a href="${audioUrl}" target="_blank">View Audio File</a></p>
                    </div>
                `;
                $('.audio-meta-box').prepend(audioHtml);
            }
        }
    }
    
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    function showAdminNotice(message, type = 'info') {
        const $notice = $(`
            <div class="notice notice-${type} ebook-admin-notice is-dismissible">
                <p>${message}</p>
            </div>
        `);
        
        $('.wrap h1').after($notice);
        
        // Auto-dismiss after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(function() {
                $notice.fadeOut();
            }, 5000);
        }
        
        // Make dismissible
        $notice.find('.notice-dismiss').on('click', function() {
            $notice.fadeOut();
        });
    }
    
    function showAdminTips() {
        const tips = `
            <div class="ebook-admin-notice notice-info">
                <h3>📚 Welcome to eBook Chapter Management!</h3>
                <p><strong>Quick Tips:</strong></p>
                <ul>
                    <li>✏️ Write your chapter content in the main editor</li>
                    <li>📖 Select or create an eBook to organize your chapters</li>
                    <li>🔢 Set chapter order to control the reading sequence</li>
                    <li>🎵 Generate audio automatically from your text content</li>
                    <li>👀 Use the shortcode <code>[ebook_slider ebook="your-ebook-slug"]</code> to display your eBook</li>
                </ul>
                <button type="button" class="notice-dismiss"><span class="screen-reader-text">Dismiss this notice.</span></button>
            </div>
        `;
        
        $('.wrap h1').after(tips);
    }
});

// AJAX handler for adding new ebooks
jQuery(document).ajaxSuccess(function(event, xhr, settings) {
    if (settings.data && settings.data.indexOf('action=add_new_ebook') !== -1) {
        // Refresh the ebook list if needed
        console.log('eBook added successfully');
    }
});

// Global error handler for ebook admin
jQuery(document).ajaxError(function(event, xhr, settings, error) {
    if (settings.data && settings.data.indexOf('ebook') !== -1) {
        console.error('eBook AJAX Error:', error);
    }
});